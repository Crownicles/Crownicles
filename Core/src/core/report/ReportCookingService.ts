import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	CommandReportCookingIgniteReq,
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
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
	CookingCraftErrors,
	CookingCraftError,
	CookingSlotData,
	CraftPetFoodResult,
	CraftMaterialResult,
	PinnedRecipeInfo
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CookingService } from "../cooking/CookingService";
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
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Materials } from "../database/game/models/Material";
import { PotionDataController } from "../../data/Potion";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getCookingGrade, CookingOutputType, CookingOutputTypeValue,
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
 * Maps keycloakId → { materialId, rarity, timeout } so that when a player
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

interface IgniteOrReviveParams {
	slots: CookingSlotData[];
	woodConsumed: boolean;
	woodMaterialId: number;
	cookingLevel: number;
}

function buildIgniteOrReviveResponse(PacketClass: typeof CommandReportCookingIgniteRes, params: IgniteOrReviveParams): CommandReportCookingIgniteRes;
function buildIgniteOrReviveResponse(PacketClass: typeof CommandReportCookingReviveRes, params: IgniteOrReviveParams): CommandReportCookingReviveRes;
function buildIgniteOrReviveResponse(
	PacketClass: typeof CommandReportCookingIgniteRes | typeof CommandReportCookingReviveRes,
	params: IgniteOrReviveParams
): CommandReportCookingIgniteRes | CommandReportCookingReviveRes {
	return makePacket(PacketClass, {
		...params,
		cookingGrade: getCookingGrade(params.cookingLevel).id
	});
}

interface BlockedCraftParams {
	player: Player;
	homeId: number;
	cookingSlots: number;
	error: CookingCraftError;
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutputTypeValue;
}

async function buildBlockedCraftResponse(params: BlockedCraftParams): Promise<CommandReportCookingCraftRes> {
	const {
		player, homeId, cookingSlots, ...craftInfo
	} = params;
	const updatedSlots = await CookingService.getSlotRecipes({
		player, homeId, cookingSlots
	});

	return makePacket(CommandReportCookingCraftRes, {
		success: false,
		...craftInfo,
		cookingXpGained: 0,
		cookingLevelUp: false,
		updatedSlots
	});
}

async function igniteOrReviveFurnace(
	keycloakId: string,
	response: CrowniclesPacket[],
	PacketClass: typeof CommandReportCookingIgniteRes | typeof CommandReportCookingReviveRes
): Promise<void> {
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
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

	// Check wood save buff (Chef de table grade)
	const grade = getCookingGrade(player.cookingLevel);
	const woodSaved = grade.woodSaveChance > 0 && RandomUtils.crowniclesRandom.realZeroToOneInclusive() < grade.woodSaveChance;

	if (!woodSaved) {
		await Materials.consumeMaterial(player.id, wood.materialId, 1);
	}

	// Advance furnace position
	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.furnacePosition++;
		await lockedPlayer.save();
	});
	player.furnacePosition++;

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	response.push(buildIgniteOrReviveResponse(PacketClass, {
		slots, woodConsumed: !woodSaved, woodMaterialId: wood.materialId, cookingLevel: player.cookingLevel
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

	if (!packet.accepted || !pending) {
		// Cancelled — return empty so Discord goes back to cooking menu
		return response;
	}

	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return response;
	}
	const {
		player, home, cookingSlots
	} = data;

	// Consume the confirmed wood (no save buff — player already confirmed rare wood)
	await Materials.consumeMaterial(player.id, pending.materialId, 1);

	// Advance furnace position
	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.furnacePosition++;
		await lockedPlayer.save();
	});
	player.furnacePosition++;

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	const ResponseClass = pending.isRevive ? CommandReportCookingReviveRes : CommandReportCookingIgniteRes;
	response.push(buildIgniteOrReviveResponse(ResponseClass, {
		slots, woodConsumed: true, woodMaterialId: pending.materialId, cookingLevel: player.cookingLevel
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
	petFood?: CraftPetFoodResult;
	material?: CraftMaterialResult;
	failedPotionId?: number;
	bonusOutput?: boolean;
	inventorySwapPackets?: CrowniclesPacket[];
}

async function handlePotionOutput(
	player: Player,
	recipe: CookingRecipeData,
	context: PacketContext,
	bonus: boolean
): Promise<CraftOutputResult> {
	if (recipe.potionNature === undefined || recipe.potionRarity === undefined) {
		return {};
	}
	let effectiveRarity = recipe.potionRarity;
	let bonusApplied = false;
	if (bonus && recipe.potionRarity < ItemRarity.MYTHICAL) {
		const upgradedRarity = recipe.potionRarity + 1;
		if (PotionDataController.instance.hasItemWithNatureAndRarity(recipe.potionNature, upgradedRarity)) {
			effectiveRarity = upgradedRarity;
			bonusApplied = true;
		}
	}
	if (!PotionDataController.instance.hasItemWithNatureAndRarity(recipe.potionNature, effectiveRarity)) {
		return {};
	}
	const potion = PotionDataController.instance.randomItem(recipe.potionNature, effectiveRarity);
	const itemReceived = await player.giveItem(potion);
	const result: CraftOutputResult = { potionId: potion.id };
	if (bonusApplied) {
		result.bonusOutput = true;
	}
	if (!itemReceived) {
		result.inventorySwapPackets = [];
		await giveItemToPlayer(result.inventorySwapPackets, context, player, potion);
	}
	return result;
}

/**
 * Run the locked critical section that re-reads the guild
 * pantry, computes available space, and stores as much pet food
 * as fits before saving the guild row. Returns the actually
 * stored quantity so the caller can compute the surplus.
 */
async function runPetFoodOutputUnderLock(
	guildId: number,
	recipe: CookingRecipeData,
	effectiveQuantity: number
): Promise<number> {
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

async function handlePetFoodOutput(
	player: Player,
	recipe: CookingRecipeData,
	guild: Guild,
	bonus: boolean
): Promise<CraftOutputResult> {
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
	const storedQuantity = await runPetFoodOutputUnderLock(guild.id, recipe, effectiveQuantity);

	const surplus = effectiveQuantity - storedQuantity;
	const surplusResult = surplus > 0
		? await handlePetFoodSurplus(player, recipe, surplus)
		: {};

	const result: CraftOutputResult = {
		petFood: {
			type: recipe.petFood.type,
			quantity: effectiveQuantity,
			storedQuantity,
			...surplusResult
		}
	};
	if (bonus) {
		result.bonusOutput = true;
	}
	return result;
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

async function handleMaterialOutput(
	player: Player,
	recipe: CookingRecipeData,
	bonus: boolean
): Promise<CraftOutputResult> {
	if (recipe.outputMaterialId === undefined || recipe.outputMaterialQuantity === undefined) {
		return {};
	}
	const effectiveQuantity = recipe.outputMaterialQuantity + (bonus ? 1 : 0);
	await Materials.giveMaterial(player.id, recipe.outputMaterialId, effectiveQuantity);
	const result: CraftOutputResult = {
		material: {
			materialId: recipe.outputMaterialId,
			quantity: effectiveQuantity
		}
	};
	if (bonus) {
		result.bonusOutput = true;
	}
	return result;
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
	result: { success: boolean };
	guild: Guild | null;
}

async function processSuccessfulCraftOutput({
	context,
	player,
	recipe,
	guild
}: Omit<CraftOutputParams, "result">): Promise<CraftOutputResult> {
	const grade = getCookingGrade(player.cookingLevel);
	const bonus = RandomUtils.crowniclesRandom.realZeroToOneInclusive() < grade.bonusOutputChance;
	switch (recipe.outputType) {
		case CookingOutputType.POTION:
			return await handlePotionOutput(player, recipe, context, bonus);
		case CookingOutputType.PET_FOOD:
			return guild ? await handlePetFoodOutput(player, recipe, guild, bonus) : {};
		case CookingOutputType.MATERIAL:
			return await handleMaterialOutput(player, recipe, bonus);
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
	guild: Guild | null
): CookingCraftError | null {
	if (!slot?.recipe || !recipe) {
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

export async function handleCookingCraft(
	keycloakId: string,
	packet: CommandReportCookingCraftReq,
	context: PacketContext
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return response;
	}
	const {
		player, home, cookingSlots
	} = data;

	// Get the current slots to find the recipe at the requested slot
	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	const slot = slots.find(s => s.slotIndex === packet.slotIndex);
	const recipe = slot?.recipe ? CookingRecipeDataController.instance.getById(slot.recipe.id) : undefined;
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;

	const validationError = validateCraftRequest(slot, recipe, guild);
	if (validationError) {
		response.push(await buildBlockedCraftResponse({
			player,
			homeId: home.id,
			cookingSlots,
			error: validationError,
			...getCraftErrorInfo(slot, recipe)
		}));
		return response;
	}

	// After validation, recipe and slot.recipe are guaranteed to exist
	const validatedRecipe = recipe!;
	const validatedSlotRecipe = slot!.recipe!;

	// Execute the craft
	const result = await CookingService.executeCraft({
		player, recipe: validatedRecipe, homeId: home.id
	});

	// Determine and apply output
	const outputResult = await processCraftOutput({
		context,
		player,
		recipe: validatedRecipe,
		result,
		guild
	});

	const updatedSlots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});

	response.push(makePacket(CommandReportCookingCraftRes, {
		success: result.success,
		recipeId: validatedRecipe.id,
		wasSecret: validatedSlotRecipe.isSecret,
		outputType: validatedRecipe.outputType,
		...outputResult,
		cookingXpGained: result.xpGained,
		cookingLevelUp: result.levelUp,
		newCookingLevel: result.newLevel,
		newCookingGrade: result.newGrade,
		materialSaved: result.materialSaved,
		discoveredRecipeIds: result.discoveredRecipeIds,
		updatedSlots
	}));
	if (outputResult.inventorySwapPackets) {
		response.push(...outputResult.inventorySwapPackets);
	}
	return response;
}

export async function handleCookingMenu(
	keycloakId: string,
	_packet: CommandReportCookingMenuReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return response;
	}
	const {
		player, home
	} = data;
	const grade = getCookingGrade(player.cookingLevel);

	let pinnedRecipe: PinnedRecipeInfo | undefined;
	if (player.pinnedCookingRecipeId) {
		const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
		pinnedRecipe = await CookingService.getPinnedRecipeInfo({
			player,
			homeId: home.id,
			recipeId: player.pinnedCookingRecipeId,
			guild
		}) ?? undefined;
		if (!pinnedRecipe) {
			/*
			 * Recipe no longer exists, clear the pin under the row lock
			 * so a concurrent pin/unpin from another device cannot re-emerge
			 * after we believe we cleared it.
			 */
			await Player.withLocked(player.id, async lockedPlayer => {
				lockedPlayer.pinnedCookingRecipeId = null;
				await lockedPlayer.save();
			});
			player.pinnedCookingRecipeId = null;
		}
	}

	response.push(makePacket(CommandReportCookingMenuRes, {
		cookingLevel: player.cookingLevel,
		cookingGrade: grade.id,
		pinnedRecipe
	}));
	return response;
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
		return response;
	}
	const {
		player, home
	} = data;

	const validated = await validatePinRecipe(player, packet.recipeId);
	if (!validated) {
		return response;
	}

	const pinnedRecipe = await CookingService.getPinnedRecipeInfo({
		player,
		homeId: home.id,
		recipeId: packet.recipeId,
		guild: validated.guild
	});
	if (!pinnedRecipe) {
		return response;
	}

	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.pinnedCookingRecipeId = packet.recipeId;
		await lockedPlayer.save();
	});

	response.push(makePacket(CommandReportCookingPinRes, {
		pinnedRecipe
	}));
	return response;
}

export async function handleCookingUnpin(
	keycloakId: string,
	_packet: CommandReportCookingUnpinReq
): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	const data = await getPlayerAndHome(keycloakId);
	if (!data) {
		return response;
	}
	const { player } = data;

	await Player.withLocked(player.id, async lockedPlayer => {
		lockedPlayer.pinnedCookingRecipeId = null;
		await lockedPlayer.save();
	});

	response.push(makePacket(CommandReportCookingUnpinRes, {}));
	return response;
}
