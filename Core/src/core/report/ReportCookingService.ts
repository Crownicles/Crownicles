import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	CommandReportCookingIgniteReq,
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
	CommandReportCookingUnavailableRes,
	CommandReportCookingWoodConfirmRes,
	CommandReportCookingWoodConfirmReq,
	CommandReportCookingReviveReq,
	CommandReportCookingReviveRes,
	CommandReportCookingCraftReq,
	CommandReportCookingCraftRes,
	CommandReportCookingMenuReq,
	CommandReportCookingMenuRes,
	CommandReportCookingPinReq,
	CommandReportCookingPinRes,
	CommandReportCookingUnpinReq,
	CommandReportCookingUnpinRes,
	CommandReportCookingSetSpecialtyReq,
	CommandReportCookingSetSpecialtyRes,
	CommandReportCookingRemoveSpecialtyReq,
	CommandReportCookingRemoveSpecialtyRes,
	CookingCraftErrors,
	CookingCraftError,
	CookingSpecialtyErrors,
	CookingSpecialtyError,
	CookingSlotData,
	CookingSlotRecipeRef,
	CookingMenuSnapshot,
	CraftPetFoodResult,
	CraftMaterialResult,
	PinnedRecipeInfo
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	CookingService, type CraftResult
} from "../cooking/CookingService";
import {
	CookingRecipeData, CookingRecipeDataController
} from "../../data/CookingRecipeData";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import {
	Guilds, Guild
} from "../database/game/models/Guild";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Materials } from "../database/game/models/Material";
import { PotionDataController } from "../../data/Potion";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getCookingGrade, CookingOutputType, CookingOutputTypeValue, getCookingSpecialtiesLimit, hasUnlockedCookingSpecialties,
	TIME_POTION_WEEKLY_CRAFT_LIMIT,
	SPECIALTY_SLOT_INDEX,
	FAILED_CRAFT_CONSOLATION_CHANCE, FAILED_CRAFT_CONSOLATION_MIN_RARITY, FAILED_CRAFT_CONSOLATION_MAX_RARITY
} from "../../../../Lib/src/constants/CookingConstants";
import {
	ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { giveItemToPlayer } from "../utils/ItemUtils";
import {
	asMinutes, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { PlayerCookingRecipe } from "../database/game/models/PlayerCookingRecipe";
import { PlayerCookingSpecialty } from "../database/game/models/PlayerCookingSpecialty";
import { crowniclesInstance } from "../../app";
import { MissionsController } from "../missions/MissionsController";
import { updateCollectMaterialsMission } from "../utils/MaterialLootUtils";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import type { CookingUseLogParams } from "../database/logs/LogsCityLogger";
import type { CookingRecipeId } from "../../../../Lib/src/types/CookingRecipe";

interface PlayerAndHome {
	player: Player;
	home: Home;
	cookingSlots: number;
}

interface ValidatedPinRecipe {
	recipe: CookingRecipeData;
	guild: Guild | null;
}

/**
 * Temporary in-memory store for pending wood confirmations.
 * Maps keycloakId -> { materialId, rarity, timeout } so that when a player
 * confirms, we know which wood was originally selected.
 * Entries auto-expire after 5 minutes to prevent memory leaks.
 */
const WOOD_CONFIRMATION_TTL = minutesToMilliseconds(asMinutes(5));

interface PendingWoodConfirmation {
	materialId: number;
	rarity: MaterialRarity;
	isRevive: boolean;
}

const pendingWoodConfirmations = new Map<string, PendingWoodConfirmation & {
	timeout: NodeJS.Timeout;
}>();

function setPendingWoodConfirmation(keycloakId: string, pending: PendingWoodConfirmation): void {
	const existing = pendingWoodConfirmations.get(keycloakId);
	if (existing) {
		clearTimeout(existing.timeout);
	}
	const timeout = setTimeout(() => pendingWoodConfirmations.delete(keycloakId), WOOD_CONFIRMATION_TTL);
	pendingWoodConfirmations.set(keycloakId, {
		...pending,
		timeout
	});
}

function consumePendingWoodConfirmation(keycloakId: string): PendingWoodConfirmation | undefined {
	const pending = pendingWoodConfirmations.get(keycloakId);
	if (!pending) {
		return undefined;
	}
	clearTimeout(pending.timeout);
	pendingWoodConfirmations.delete(keycloakId);
	const {
		timeout: _, ...confirmation
	} = pending;
	return confirmation;
}

async function getPlayerAndHome(keycloakId: string): Promise<PlayerAndHome | null> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return null;
	}
	const home = await Homes.getOfPlayer(player.id);
	const homeLevel = home?.getLevel();
	if (!homeLevel || homeLevel.features.cookingSlots <= 0) {
		return null;
	}
	return {
		player,
		home: home!,
		cookingSlots: homeLevel.features.cookingSlots
	};
}

interface CookingMenuSnapshotParams {
	player: Player;
	home: Home;
	cookingSlots: number;
	isIgnited: boolean;

	/**
	 * Pre-computed ignited slots. When `isIgnited` is `true`, callers that
	 * already loaded the slots (ignite/craft handlers) should pass them to
	 * avoid a redundant query. When omitted but `isIgnited` is `true`, the
	 * helper fetches them itself. Ignored when `isIgnited` is `false`.
	 */
	currentSlots?: CookingSlotData[];
}

/**
 * Build the authoritative cooking-menu snapshot for the given player.
 *
 * This is the single source of truth for every cooking response packet:
 * the Discord client renders exclusively from the returned snapshot and
 * does not maintain any local cooking state. The helper also self-heals a
 * stale pin (recipe pinned but no longer discoverable/valid) by clearing
 * `pinnedCookingRecipeId` under the player row lock.
 */
async function buildCookingMenuSnapshot(params: CookingMenuSnapshotParams): Promise<CookingMenuSnapshot> {
	const {
		player, home, cookingSlots, isIgnited, currentSlots
	} = params;

	const grade = getCookingGrade(player.cookingLevel);
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;

	let pinnedRecipe: PinnedRecipeInfo | undefined;
	if (player.pinnedCookingRecipeId) {
		const observedPinnedId = player.pinnedCookingRecipeId;
		pinnedRecipe = await CookingService.getPinnedRecipeInfo({
			player,
			homeId: home.id,
			recipeId: observedPinnedId,
			guild
		}) ?? undefined;

		if (!pinnedRecipe) {
			/*
			 * Recipe no longer exists or is no longer accessible. Clear the
			 * pin under the row lock with a compare-and-swap: only erase if
			 * the pinned id still matches what we observed, so a concurrent
			 * pin from another shard between our read and our write is not
			 * silently overwritten.
			 */
			await Player.withLocked(player.id, async lockedPlayer => {
				if (lockedPlayer.pinnedCookingRecipeId === observedPinnedId) {
					lockedPlayer.pinnedCookingRecipeId = null;
					await lockedPlayer.save();
					player.pinnedCookingRecipeId = null;
				}
			});
		}
	}

	let slots: CookingSlotData[];
	if (isIgnited) {
		slots = currentSlots ?? await CookingService.getSlotRecipes({
			player,
			homeId: home.id,
			cookingSlots
		});
	}
	else {
		slots = [];
	}

	const specialties = await CookingService.getSpecialtiesInfo({
		player,
		homeId: home.id,
		guild
	});

	return {
		cookingLevel: player.cookingLevel,
		cookingGrade: grade.id,
		pinnedRecipe,
		...specialties.length > 0 ? { specialties } : {},
		currentSlots: slots,
		isIgnited
	};
}

interface IgniteOrReviveParams {
	woodConsumed: boolean;
	woodMaterialId: number;
	menu: CookingMenuSnapshot;
}

function buildIgniteOrReviveResponse(PacketClass: typeof CommandReportCookingIgniteRes, params: IgniteOrReviveParams): CommandReportCookingIgniteRes;
function buildIgniteOrReviveResponse(PacketClass: typeof CommandReportCookingReviveRes, params: IgniteOrReviveParams): CommandReportCookingReviveRes;
function buildIgniteOrReviveResponse(
	PacketClass: typeof CommandReportCookingIgniteRes | typeof CommandReportCookingReviveRes,
	params: IgniteOrReviveParams
): CommandReportCookingIgniteRes | CommandReportCookingReviveRes {
	return makePacket(PacketClass, params);
}

interface BlockedCraftParams {
	player: Player;
	home: Home;
	cookingSlots: number;
	error: CookingCraftError;
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutputTypeValue;
}

async function buildBlockedCraftResponse(params: BlockedCraftParams): Promise<CommandReportCookingCraftRes> {
	const {
		player, home, cookingSlots, ...craftInfo
	} = params;
	const menu = await buildCookingMenuSnapshot({
		player, home, cookingSlots, isIgnited: true
	});

	return makePacket(CommandReportCookingCraftRes, {
		success: false,
		...craftInfo,
		cookingXpGained: 0,
		cookingLevelUp: false,
		menu
	});
}

async function igniteOrReviveFurnace(
	keycloakId: string,
	response: CrowniclesPacket[],
	PacketClass: typeof CommandReportCookingIgniteRes | typeof CommandReportCookingReviveRes
): Promise<void> {
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		response.push(makePacket(CommandReportCookingUnavailableRes, {}));
		return;
	}
	const {
		player, home, cookingSlots
	} = data;

	// Get wood
	const wood = await CookingService.getWoodToConsume(player.id);
	if (!wood) {
		response.push(makePacket(CommandReportCookingNoWoodRes, {}));
		return;
	}

	// Non-common wood needs confirmation
	if (wood.needsConfirmation) {
		const isRevive = PacketClass === CommandReportCookingReviveRes;
		setPendingWoodConfirmation(keycloakId, {
			materialId: wood.materialId,
			rarity: wood.rarity,
			isRevive
		});
		response.push(makePacket(CommandReportCookingWoodConfirmReq, {
			woodMaterialId: wood.materialId,
			woodRarity: wood.rarity
		}));
		return;
	}

	/*
	 * Run the whole ignite operation under the player row lock so two
	 * concurrent ignite requests for the same player cannot both pass
	 * the wood-save roll and consume wood twice (or both advance the
	 * furnace position from the same starting value). The wood-save
	 * buff roll, the material consumption and the furnacePosition
	 * increment are all part of the same critical section.
	 */
	const woodSaved = await Player.withLocked(player.id, async lockedPlayer => {
		const grade = getCookingGrade(lockedPlayer.cookingLevel);
		const saved = grade.woodSaveChance > 0 && RandomUtils.crowniclesRandom.realZeroToOneInclusive() < grade.woodSaveChance;
		if (!saved) {
			await Materials.consumeMaterial(lockedPlayer.id, wood.materialId, 1);
		}
		lockedPlayer.furnacePosition++;
		await lockedPlayer.save();
		player.furnacePosition = lockedPlayer.furnacePosition;
		return saved;
	});

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	const menu = await buildCookingMenuSnapshot({
		player, home, cookingSlots, isIgnited: true, currentSlots: slots
	});
	response.push(buildIgniteOrReviveResponse(PacketClass, {
		woodConsumed: !woodSaved, woodMaterialId: wood.materialId, menu
	}));
}

export async function handleCookingIgnite(
	keycloakId: string,
	_packet: CommandReportCookingIgniteReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await igniteOrReviveFurnace(keycloakId, response, CommandReportCookingIgniteRes);
	return response;
}

export async function handleCookingWoodConfirm(
	keycloakId: string,
	packet: CommandReportCookingWoodConfirmRes
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const pending = consumePendingWoodConfirmation(keycloakId);

	if (!packet.accepted) {
		return buildCookingMenuResponse(await getPlayerAndHome(keycloakId), pending?.isRevive ?? false);
	}
	if (!pending) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}

	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}
	const {
		player, home, cookingSlots
	} = data;

	/*
	 * Consume the confirmed wood (no save buff — player already confirmed rare wood)
	 * Run consume + furnacePosition advance under the player lock so two
	 * concurrent confirmations cannot race against each other.
	 */
	await Player.withLocked(player.id, async lockedPlayer => {
		await Materials.consumeMaterial(lockedPlayer.id, pending.materialId, 1);
		lockedPlayer.furnacePosition++;
		await lockedPlayer.save();
		player.furnacePosition = lockedPlayer.furnacePosition;
	});

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	const menu = await buildCookingMenuSnapshot({
		player, home, cookingSlots, isIgnited: true, currentSlots: slots
	});
	const ResponseClass = pending.isRevive ? CommandReportCookingReviveRes : CommandReportCookingIgniteRes;
	response.push(buildIgniteOrReviveResponse(ResponseClass, {
		woodConsumed: true, woodMaterialId: pending.materialId, menu
	}));
	return response;
}

export async function handleCookingRevive(
	keycloakId: string,
	_packet: CommandReportCookingReviveReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await igniteOrReviveFurnace(keycloakId, response, CommandReportCookingReviveRes);
	return response;
}

interface CraftOutputResult {
	potionId?: number;
	potionRarity?: number;
	petFood?: CraftPetFoodResult;
	material?: CraftMaterialResult;
	failedPotionId?: number;
	inventorySwapPackets?: CrowniclesPacket[];

	/**
	 * Whether the bonus output flag should be honored in the response.
	 * Falls back to `false` when no tangible bonus was applied (e.g.,
	 * potion at MYTHICAL cap, upgraded rarity has no item, recipe
	 * output type without bonus support).
	 */
	bonusHonored?: boolean;
}

/**
 * Returns the effective potion rarity to award, honoring the
 * MYTHICAL cap and falling back to the base rarity if the
 * upgraded one has no available item. Returns null if no item
 * exists for the base rarity either.
 */
export function computeEffectivePotionRarity(nature: number, baseRarity: number, bonus: boolean): number | null {
	let effective = baseRarity;
	if (bonus && baseRarity < ItemRarity.MYTHICAL) {
		const upgraded = baseRarity + 1;
		if (PotionDataController.instance.hasItemWithNatureAndRarity(nature, upgraded)) {
			effective = upgraded;
		}
	}
	if (!PotionDataController.instance.hasItemWithNatureAndRarity(nature, effective)) {
		return null;
	}
	return effective;
}

interface PotionOutputParams {
	player: Player;
	recipe: CookingRecipeData;
	context: PacketContext;
	bonus: boolean;
}

export async function handlePotionOutput({
	player, recipe, context, bonus
}: PotionOutputParams): Promise<CraftOutputResult> {
	if (recipe.potionNature === undefined || recipe.potionRarity === undefined) {
		return {};
	}
	const effectiveRarity = computeEffectivePotionRarity(recipe.potionNature, recipe.potionRarity, bonus);
	if (effectiveRarity === null) {
		return {};
	}
	const potion = PotionDataController.instance.randomItem(recipe.potionNature, effectiveRarity);
	const inventorySwapPackets: CrowniclesPacket[] = [];
	await giveItemToPlayer(inventorySwapPackets, context, player, potion);
	return {
		potionId: potion.id,
		potionRarity: effectiveRarity,
		inventorySwapPackets,
		bonusHonored: bonus && effectiveRarity > recipe.potionRarity
	};
}

interface PetFoodLockParams {
	guildId: number;
	recipe: CookingRecipeData;
	effectiveQuantity: number;
}

/**
 * Run the locked critical section that re-reads the guild
 * pantry, computes available space, and stores as much pet food
 * as fits before saving the guild row. Returns the actually
 * stored quantity so the caller can compute the surplus.
 */
async function runPetFoodOutputUnderLock({
	guildId, recipe, effectiveQuantity
}: PetFoodLockParams): Promise<number> {
	if (!recipe.petFood) {
		return 0;
	}
	try {
		return await withLockedEntities(
			[Guild.lockKey(guildId)] as const,
			async ([lockedGuild]) => {
				const availableSpace = CookingService.getAvailableFoodSpace(lockedGuild, recipe.petFood!.type);
				const storedQuantity = Math.min(effectiveQuantity, availableSpace);
				if (storedQuantity > 0) {
					lockedGuild.addFood(recipe.petFood!.type, storedQuantity, NumberChangeReason.COOKING);
					await lockedGuild.save();
				}
				return storedQuantity;
			}
		);
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * The guild was destroyed between the recipe choice
			 * and the storage. Nothing was stored; the caller
			 * will route the entire batch as surplus.
			 */
			return 0;
		}
		throw error;
	}
}

interface PetFoodOutputParams {
	player: Player;
	recipe: CookingRecipeData;
	guild: Guild;
	bonus: boolean;
}

async function handlePetFoodOutput({
	player, recipe, guild, bonus
}: PetFoodOutputParams): Promise<CraftOutputResult> {
	if (!recipe.petFood) {
		return {};
	}

	const effectiveQuantity = recipe.petFood.quantity + (bonus ? 1 : 0);

	/*
	 * Lock the guild row so two concurrent cookings from
	 * different members cannot race the addFood + save sequence
	 * and lose increments. The locked guild instance is the one
	 * we read inside the critical section so the available-space
	 * check is consistent with the eventual save.
	 */
	const storedQuantity = await runPetFoodOutputUnderLock({
		guildId: guild.id, recipe, effectiveQuantity
	});

	const surplus = effectiveQuantity - storedQuantity;
	const surplusResult = surplus > 0
		? await handlePetFoodSurplus(player, recipe, surplus)
		: {};

	return {
		petFood: {
			type: recipe.petFood.type,
			quantity: effectiveQuantity,
			storedQuantity,
			...surplusResult
		},
		bonusHonored: bonus
	};
}

async function handlePetFoodSurplus(
	player: Player,
	recipe: CookingRecipeData,
	surplus: number
): Promise<Partial<CraftPetFoodResult>> {
	const result: Partial<CraftPetFoodResult> = {};
	let remaining = surplus;

	const hungryPet = await CookingService.getHungryCompatiblePet(player, recipe.petFood!.type);
	if (hungryPet) {
		await CookingService.feedPetFromSurplus(player, hungryPet, recipe.petFood!.type);
		result.fedFromSurplus = true;
		remaining--;
	}

	if (remaining > 0) {
		const recycleMaterialId = CookingService.getSurplusRecycleMaterial(recipe);
		if (recycleMaterialId !== undefined) {
			await Materials.giveMaterial(player.id, recycleMaterialId, remaining);
			result.surplusMaterialId = recycleMaterialId;
			result.surplusMaterialQuantity = remaining;
		}
	}

	return result;
}

interface MaterialOutputParams {
	player: Player;
	recipe: CookingRecipeData;
	bonus: boolean;
}

async function handleMaterialOutput({
	player, recipe, bonus
}: MaterialOutputParams): Promise<CraftOutputResult> {
	if (recipe.outputMaterialId === undefined || recipe.outputMaterialQuantity === undefined) {
		return {};
	}
	const effectiveQuantity = recipe.outputMaterialQuantity + (bonus ? 1 : 0);
	await Materials.giveMaterial(player.id, recipe.outputMaterialId, effectiveQuantity);
	return {
		material: {
			materialId: recipe.outputMaterialId,
			quantity: effectiveQuantity
		},
		bonusHonored: bonus
	};
}

async function handleFailedPotionOutput(
	player: Player,
	context: PacketContext
): Promise<CraftOutputResult> {
	if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() > FAILED_CRAFT_CONSOLATION_CHANCE) {
		return {};
	}

	const rarity = RandomUtils.crowniclesRandom.integer(
		FAILED_CRAFT_CONSOLATION_MIN_RARITY,
		FAILED_CRAFT_CONSOLATION_MAX_RARITY
	);

	if (!PotionDataController.instance.hasItemWithNatureAndRarity(ItemNature.NONE, rarity)) {
		return {};
	}

	const potion = PotionDataController.instance.randomItem(ItemNature.NONE, rarity);
	const itemReceived = await player.giveItem(potion);
	const result: CraftOutputResult = { failedPotionId: potion.id };
	if (!itemReceived) {
		result.inventorySwapPackets = [];
		await giveItemToPlayer(result.inventorySwapPackets, context, player, potion);
	}
	return result;
}

interface CraftOutputParams {
	context: PacketContext;
	player: Player;
	recipe: CookingRecipeData;
	result: {
		success: boolean;
		bonusOutput: boolean;
	};
	guild: Guild | null;
}

async function processSuccessfulCraftOutput({
	context,
	player,
	recipe,
	guild,
	result
}: CraftOutputParams): Promise<CraftOutputResult> {
	const bonus = result.bonusOutput;
	switch (recipe.outputType) {
		case CookingOutputType.POTION:
			return await handlePotionOutput({
				player, recipe, context, bonus
			});
		case CookingOutputType.PET_FOOD:
			return guild
				? await handlePetFoodOutput({
					player, recipe, guild, bonus
				})
				: {};
		case CookingOutputType.MATERIAL:
			return await handleMaterialOutput({
				player, recipe, bonus
			});
		default:
			return {};
	}
}

async function processFailedCraftOutput({
	context,
	player,
	recipe
}: Omit<CraftOutputParams, "result" | "guild">): Promise<CraftOutputResult> {
	if (recipe.outputType === CookingOutputType.POTION) {
		return await handleFailedPotionOutput(player, context);
	}
	return {};
}

async function processCraftOutput(params: CraftOutputParams): Promise<CraftOutputResult> {
	if (!params.result.success) {
		return await processFailedCraftOutput(params);
	}
	return await processSuccessfulCraftOutput(params);
}

interface CraftErrorInfo {
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutputTypeValue;
}

interface CookingCraftContext {
	player: Player;
	home: Home;
	cookingSlots: number;
	slot: CookingSlotData | undefined;
	recipe: CookingRecipeData | undefined;
	guild: Guild | null;
}

interface ReadyCookingCraftContext {
	player: Player;
	home: Home;
	cookingSlots: number;
	slotRecipe: NonNullable<CookingSlotData["recipe"]>;
	recipe: CookingRecipeData;
	guild: Guild | null;
}

interface CompletedCraftParams {
	craftContext: ReadyCookingCraftContext;
	result: CraftResult;
	outputResult: CraftOutputResult;
}

function getCraftErrorInfo(
	slot: CookingSlotData | undefined,
	recipe: CookingRecipeData | undefined
): CraftErrorInfo {
	return {
		recipeId: recipe?.id ?? "",
		wasSecret: slot?.recipe?.isSecret ?? false,
		outputType: recipe?.outputType ?? CookingOutputType.POTION
	};
}

function validateCraftRequest(
	slot: CookingSlotData | undefined,
	recipe: CookingRecipeData | undefined,
	guild: Guild | null,
	requestedRecipeId: CookingRecipeId
): CookingCraftError | null {
	if (!slot?.recipe || !recipe) {
		return CookingCraftErrors.CRAFT_UNAVAILABLE;
	}

	/*
	 * The displayed menu is a snapshot. Never craft whatever currently happens
	 * to occupy a slot when the snapshot used for the click is stale.
	 */
	if (slot.recipe.id !== requestedRecipeId) {
		return CookingCraftErrors.CRAFT_UNAVAILABLE;
	}
	if (recipe.outputType === CookingOutputType.PET_FOOD && !guild) {
		return CookingCraftErrors.GUILD_REQUIRED;
	}
	if (!slot.recipe.canCraft) {
		return CookingCraftErrors.CRAFT_UNAVAILABLE;
	}
	return null;
}

/**
 * A time potion stays offered once the weekly limit is reached, only to be refused with an explanation.
 * Checked before the other validations, which would only see a recipe that can't be cooked.
 */
function getTimePotionLimitError(slot: CookingSlotData | undefined, requestedRecipeId: CookingRecipeId): CookingCraftError | null {
	return slot?.recipe?.id === requestedRecipeId && slot.recipe.timePotionsLeftThisWeek === 0
		? CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT
		: null;
}

async function loadCookingCraftContext(
	keycloakId: string,
	packet: CommandReportCookingCraftReq
): Promise<CookingCraftContext | null> {
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return null;
	}
	const {
		player, home, cookingSlots
	} = data;
	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});

	// The specialty station offers several recipes: the requested recipe identifies the row
	const slot = slots.find(slotData => slotData.slotIndex === packet.slotIndex && slotData.recipe?.id === packet.recipeId)
		?? slots.find(slotData => slotData.slotIndex === packet.slotIndex);
	const recipe = slot?.recipe ? CookingRecipeDataController.instance.getById(slot.recipe.id) : undefined;
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	return {
		player, home, cookingSlots, slot, recipe, guild
	};
}

async function buildBlockedCookingCraftPacket(
	craftContext: CookingCraftContext,
	validationError: CookingCraftError
): Promise<CommandReportCookingCraftRes> {
	return await buildBlockedCraftResponse({
		player: craftContext.player,
		home: craftContext.home,
		cookingSlots: craftContext.cookingSlots,
		error: validationError,
		...getCraftErrorInfo(craftContext.slot, craftContext.recipe)
	});
}

function buildReadyCookingCraftContext(craftContext: CookingCraftContext): ReadyCookingCraftContext | null {
	if (!craftContext.slot?.recipe || !craftContext.recipe) {
		return null;
	}
	return {
		player: craftContext.player,
		home: craftContext.home,
		cookingSlots: craftContext.cookingSlots,
		slotRecipe: craftContext.slot.recipe,
		recipe: craftContext.recipe,
		guild: craftContext.guild
	};
}

function buildCookingCraftResponsePacket({
	craftContext,
	result,
	outputResult,
	menu
}: CompletedCraftParams & { menu: CookingMenuSnapshot }): CommandReportCookingCraftRes {
	const {
		bonusHonored, inventorySwapPackets: _, ...outputForPacket
	} = outputResult;
	return makePacket(CommandReportCookingCraftRes, {
		success: result.success,
		recipeId: craftContext.recipe.id,
		wasSecret: craftContext.slotRecipe.isSecret,
		outputType: craftContext.recipe.outputType,
		...outputForPacket,
		cookingXpGained: result.xpGained,
		cookingLevelUp: result.levelUp,
		newCookingLevel: result.newLevel,
		newCookingGrade: result.newGrade,
		...result.masterChefBadgeEarned ? { masterChefBadgeEarned: true } : {},
		materialSaved: result.materialSaved,
		bonusOutput: result.bonusOutput && (bonusHonored ?? false),
		discoveredRecipes: result.discoveredRecipes,
		menu
	});
}

function appendInventorySwapPackets(response: CrowniclesPacket[], inventorySwapPackets: CrowniclesPacket[] | undefined): void {
	if (!inventorySwapPackets) {
		return;
	}
	response.push(...inventorySwapPackets);
}

function buildCookingUseLogParams({
	craftContext,
	result,
	outputResult
}: CompletedCraftParams): CookingUseLogParams {
	return {
		keycloakId: craftContext.player.keycloakId,
		cityId: craftContext.player.getCurrentCityId(),
		recipeId: craftContext.recipe.id,
		recipeLevel: craftContext.recipe.level,
		outputType: craftContext.recipe.outputType,
		success: result.success,
		bonus: result.bonusOutput && (outputResult.bonusHonored ?? false),
		wasSecret: craftContext.slotRecipe.isSecret,
		xpGained: result.xpGained,
		levelUp: result.levelUp,
		potionId: outputResult.potionId ?? outputResult.failedPotionId ?? null,
		foodType: outputResult.petFood?.type ?? null,
		foodStored: outputResult.petFood?.storedQuantity ?? null,
		foodSurplus: outputResult.petFood?.surplusMaterialQuantity ?? null,
		materialOutputId: outputResult.material?.materialId ?? null
	};
}

function logCookingUse(params: CookingUseLogParams): void {
	crowniclesInstance?.logsDatabase.logCookingUse(params).then();
}

/**
 * Take one of the time potions of the week before cooking one, so two concurrent crafts can't both take the last one
 * @returns false when the weekly limit is already reached
 */
async function takeWeeklyTimePotionUnderLock(lockedPlayer: Locked<Player>): Promise<boolean> {
	if (lockedPlayer.timePotionsCookedThisWeek >= TIME_POTION_WEEKLY_CRAFT_LIMIT) {
		return false;
	}
	lockedPlayer.timePotionsCookedThisWeek++;
	await lockedPlayer.save();
	return true;
}

/**
 * Give back the time potion taken for a craft that did not brew one
 */
async function giveBackWeeklyTimePotionUnderLock(lockedPlayer: Locked<Player>): Promise<void> {
	lockedPlayer.timePotionsCookedThisWeek = Math.max(0, lockedPlayer.timePotionsCookedThisWeek - 1);
	await lockedPlayer.save();
}

/**
 * Mirror the persisted count on the craft player without dirtying it, for the menu shown after the craft
 */
function mirrorTimePotionsCooked(player: Player, lockedPlayer: Locked<Player>): void {
	player.timePotionsCookedThisWeek = lockedPlayer.timePotionsCookedThisWeek;
	player.changed("timePotionsCookedThisWeek", false);
}

/**
 * Cook the recipe. A time potion is first taken from the weekly limit under the player lock, and given back
 * when the craft brews none, so the limit holds even for concurrent crafts.
 * @returns null when the weekly limit is reached, nothing being consumed
 */
async function executeCraftWithinWeeklyLimit({
	player, recipe, home
}: ReadyCookingCraftContext): Promise<CraftResult | null> {
	const craft = (): Promise<CraftResult> => CookingService.executeCraft({
		player, recipe, homeId: home.id
	});
	if (!CookingService.isTimePotionRecipe(recipe)) {
		return await craft();
	}

	const taken = await Player.withLocked(player.id, async lockedPlayer => {
		const hasTaken = await takeWeeklyTimePotionUnderLock(lockedPlayer);
		mirrorTimePotionsCooked(player, lockedPlayer);
		return hasTaken;
	});
	if (!taken) {
		return null;
	}

	let result: CraftResult | undefined;
	try {
		result = await craft();
		return result;
	}
	finally {
		if (!result?.success) {
			await Player.withLocked(player.id, async lockedPlayer => {
				await giveBackWeeklyTimePotionUnderLock(lockedPlayer);
				mirrorTimePotionsCooked(player, lockedPlayer);
			});
		}
	}
}

/**
 * Materials the craft added to the inventory: the recipe output or the recycled pet food surplus.
 */
function getCraftedMaterials({
	material, petFood
}: CraftOutputResult): MaterialQuantity[] {
	const surplus = petFood?.surplusMaterialId !== undefined && petFood.surplusMaterialQuantity
		? [
			{
				materialId: petFood.surplusMaterialId,
				quantity: petFood.surplusMaterialQuantity
			}
		]
		: [];
	return material ? [material, ...surplus] : surplus;
}

function buildTimePotionLimitBlock({
	player, home, cookingSlots, recipe, slotRecipe
}: ReadyCookingCraftContext): BlockedCraftParams {
	return {
		player,
		home,
		cookingSlots,
		error: CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT,
		recipeId: recipe.id,
		wasSecret: slotRecipe.isSecret,
		outputType: recipe.outputType
	};
}

async function executeReadyCookingCraft(
	craftContext: ReadyCookingCraftContext,
	packetContext: PacketContext
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const result = await executeCraftWithinWeeklyLimit(craftContext);
	if (!result) {
		return [await buildBlockedCraftResponse(buildTimePotionLimitBlock(craftContext))];
	}
	if (craftContext.player.pinnedCookingRecipeId === craftContext.recipe.id) {
		const observedPinnedId = craftContext.recipe.id;
		await Player.withLocked(craftContext.player.id, async lockedPlayer => {
			if (lockedPlayer.pinnedCookingRecipeId === observedPinnedId) {
				lockedPlayer.pinnedCookingRecipeId = null;
				await lockedPlayer.save();

				// Mirror the persisted value without dirtying the instance, or the mission update below throws (#4890)
				craftContext.player.pinnedCookingRecipeId = null;
				craftContext.player.changed("pinnedCookingRecipeId", false);
			}

			/*
			 * otherwise: another shard pinned a different recipe between our check
			 * and the lock, do not clobber their decision.
			 */
		});
	}
	const outputResult = await processCraftOutput({
		context: packetContext,
		player: craftContext.player,
		recipe: craftContext.recipe,
		result,
		guild: craftContext.guild
	});
	const updatedSlots = await CookingService.getSlotRecipes({
		player: craftContext.player,
		homeId: craftContext.home.id,
		cookingSlots: craftContext.cookingSlots
	});
	const menu = await buildCookingMenuSnapshot({
		player: craftContext.player,
		home: craftContext.home,
		cookingSlots: craftContext.cookingSlots,
		isIgnited: true,
		currentSlots: updatedSlots
	});
	response.push(buildCookingCraftResponsePacket({
		craftContext, result, outputResult, menu
	}));
	appendInventorySwapPackets(response, outputResult.inventorySwapPackets);
	logCookingUse(buildCookingUseLogParams({
		craftContext, result, outputResult
	}));
	await MissionsController.update(craftContext.player, response, { missionId: "cookRecipes" });

	if (result.levelUp) {
		await MissionsController.update(craftContext.player, response, {
			missionId: "reachCookingLevel",
			count: craftContext.player.cookingLevel,
			set: true
		});
	}

	if (outputResult.potionRarity !== undefined) {
		await MissionsController.update(craftContext.player, response, {
			missionId: "cookPotionRarity",
			params: { rarity: outputResult.potionRarity }
		});
	}

	await updateCollectMaterialsMission(craftContext.player, response, getCraftedMaterials(outputResult));

	return response;
}

export async function handleCookingCraft(
	keycloakId: string,
	packet: CommandReportCookingCraftReq,
	context: PacketContext
): Promise<CrowniclesPacket[]> {
	const craftContext = await loadCookingCraftContext(keycloakId, packet);
	if (craftContext === null) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}

	const validationError = getTimePotionLimitError(craftContext.slot, packet.recipeId) ?? validateCraftRequest(
		craftContext.slot,
		craftContext.recipe,
		craftContext.guild,
		packet.recipeId
	);
	if (validationError) {
		return [await buildBlockedCookingCraftPacket(craftContext, validationError)];
	}

	const readyCraftContext = buildReadyCookingCraftContext(craftContext);
	if (readyCraftContext === null) {
		return [await buildBlockedCookingCraftPacket(craftContext, CookingCraftErrors.CRAFT_UNAVAILABLE)];
	}

	return await executeReadyCookingCraft(readyCraftContext, context);
}

async function buildCookingMenuResponse(data: PlayerAndHome | null, isIgnited: boolean): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	if (!data) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}
	const menu = await buildCookingMenuSnapshot({
		player: data.player,
		home: data.home,
		cookingSlots: data.cookingSlots,
		isIgnited
	});
	response.push(makePacket(CommandReportCookingMenuRes, { menu }));
	return response;
}

export async function handleCookingMenu(keycloakId: string, _packet: CommandReportCookingMenuReq): Promise<CrowniclesPacket[]> {
	return buildCookingMenuResponse(await getPlayerAndHome(keycloakId), false);
}

async function validatePinRecipe(player: Player, recipeId: string): Promise<ValidatedPinRecipe | null> {
	const recipe = CookingRecipeDataController.instance.getById(recipeId);
	if (!recipe) {
		return null;
	}
	if (!recipe.discoveredByDefault) {
		const discoveredIds = await PlayerCookingRecipe.getDiscoveredRecipeIds(player);
		if (!discoveredIds.includes(recipe.id)) {
			return null;
		}
	}
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	if (recipe.outputType === CookingOutputType.PET_FOOD && !guild) {
		return null;
	}
	return {
		recipe, guild
	};
}

export async function handleCookingPin(
	keycloakId: string,
	packet: CommandReportCookingPinReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}
	const {
		player, home, cookingSlots
	} = data;

	const validated = await validatePinRecipe(player, packet.recipeId);
	if (!validated) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}

	const pinnedRecipe = await CookingService.getPinnedRecipeInfo({
		player,
		homeId: home.id,
		recipeId: packet.recipeId,
		guild: validated.guild
	});
	if (!pinnedRecipe) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}

	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.pinnedCookingRecipeId = packet.recipeId;
		await lockedPlayer.save();
	});
	player.pinnedCookingRecipeId = packet.recipeId;

	const menu = await buildCookingMenuSnapshot({
		player, home, cookingSlots, isIgnited: packet.fromIgnitedView
	});
	response.push(makePacket(CommandReportCookingPinRes, { menu }));
	return response;
}

export async function handleCookingUnpin(
	keycloakId: string,
	packet: CommandReportCookingUnpinReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return [makePacket(CommandReportCookingUnavailableRes, {})];
	}
	const {
		player, home, cookingSlots
	} = data;

	/*
	 * Snapshot the currently displayed slots while the pin is still active,
	 * so the formerly pinned recipe keeps its slot until the next furnace
	 * re-roll instead of being immediately swapped for the natural rotation
	 * recipe (only its "pinned" status is removed).
	 */
	let currentSlots: CookingSlotData[] | undefined;
	if (packet.fromIgnitedView) {
		currentSlots = await CookingService.getSlotRecipes({
			player,
			homeId: home.id,
			cookingSlots
		});
	}

	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.pinnedCookingRecipeId = null;
		await lockedPlayer.save();
	});
	player.pinnedCookingRecipeId = null;

	const menu = await buildCookingMenuSnapshot({
		player, home, cookingSlots, isIgnited: packet.fromIgnitedView, currentSlots
	});
	response.push(makePacket(CommandReportCookingUnpinRes, { menu }));
	return response;
}

/**
 * Store the specialty under the player lock, so two concurrent choices can't exceed the limit of the player's
 * cooking level. The recipe is unpinned since a specialty is already offered at every ignition.
 */
async function addSpecialtyUnderLock(lockedPlayer: Locked<Player>, recipeId: CookingRecipeId): Promise<CookingSpecialtyError | null> {
	const specialties = await PlayerCookingSpecialty.getOfPlayer(lockedPlayer.id);
	if (specialties.some(specialty => specialty.recipeId === recipeId)) {
		return CookingSpecialtyErrors.UNAVAILABLE;
	}
	if (specialties.length >= getCookingSpecialtiesLimit(lockedPlayer.cookingLevel)) {
		return CookingSpecialtyErrors.LIMIT_REACHED;
	}
	await PlayerCookingSpecialty.create({
		playerId: lockedPlayer.id,
		recipeId
	});
	if (lockedPlayer.pinnedCookingRecipeId === recipeId) {
		lockedPlayer.pinnedCookingRecipeId = null;
		await lockedPlayer.save();
	}
	return null;
}

/**
 * Only a visible recipe of a rotating station can become a specialty
 */
async function isOfferedOnRotatingStation({
	player, home, cookingSlots
}: PlayerAndHome, choice: CookingSlotRecipeRef): Promise<boolean> {
	const offeredRecipe = (await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	})).find(slot => slot.slotIndex === choice.slotIndex && slot.slotIndex !== SPECIALTY_SLOT_INDEX)?.recipe;
	return offeredRecipe?.id === choice.recipeId && !offeredRecipe.isSecret;
}

/**
 * Mirror the unpinning done under the lock without dirtying the instance used to build the menu
 */
function mirrorUnpinnedRecipe(player: Player, recipeId: CookingRecipeId): void {
	if (player.pinnedCookingRecipeId === recipeId) {
		player.pinnedCookingRecipeId = null;
		player.changed("pinnedCookingRecipeId", false);
	}
}

async function addOfferedSpecialtyUnderLock(
	lockedPlayer: Locked<Player>,
	data: PlayerAndHome,
	choice: CookingSlotRecipeRef
): Promise<CookingSpecialtyError | null> {
	if (!await isOfferedOnRotatingStation({
		...data,
		player: lockedPlayer
	}, choice)) {
		return CookingSpecialtyErrors.UNAVAILABLE;
	}
	return await addSpecialtyUnderLock(lockedPlayer, choice.recipeId);
}

/**
 * Make a recipe currently offered on a rotating station one of the player's specialties. The offer is checked under
 * the player lock, with the furnace as it is then: a concurrent re-roll can't let a stale choice through.
 */
async function setSpecialty(data: PlayerAndHome, choice: CookingSlotRecipeRef): Promise<CookingSpecialtyError | null> {
	if (!hasUnlockedCookingSpecialties(data.player.cookingLevel)) {
		return CookingSpecialtyErrors.UNAVAILABLE;
	}
	const error = await Player.withLocked(data.player.id, lockedPlayer => addOfferedSpecialtyUnderLock(lockedPlayer, data, choice));
	if (!error) {
		mirrorUnpinnedRecipe(data.player, choice.recipeId);
	}
	return error;
}

export async function handleCookingSetSpecialty(
	keycloakId: string,
	packet: CommandReportCookingSetSpecialtyReq
): Promise<CrowniclesPacket[]> {
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return [];
	}

	const error = await setSpecialty(data, {
		slotIndex: packet.slotIndex,
		recipeId: packet.recipeId
	});
	const menu = await buildCookingMenuSnapshot({
		...data,
		isIgnited: true
	});
	return [
		makePacket(CommandReportCookingSetSpecialtyRes, {
			...error ? { error } : {},
			menu
		})
	];
}

export async function handleCookingRemoveSpecialty(
	keycloakId: string,
	packet: CommandReportCookingRemoveSpecialtyReq
): Promise<CrowniclesPacket[]> {
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return [];
	}

	await PlayerCookingSpecialty.destroy({
		where: {
			playerId: data.player.id,
			recipeId: packet.recipeId
		}
	});

	const menu = await buildCookingMenuSnapshot({
		...data,
		isIgnited: packet.fromIgnitedView
	});
	return [makePacket(CommandReportCookingRemoveSpecialtyRes, { menu })];
}
