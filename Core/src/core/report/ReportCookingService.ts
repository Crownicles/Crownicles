import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	CommandReportCookingIgniteReq,
	CommandReportCookingIgniteRes,
	CommandReportCookingNoWoodRes,
	CommandReportCookingOverheatRes,
	CommandReportCookingWoodConfirmRes,
	CommandReportCookingWoodConfirmReq,
	CommandReportCookingReviveReq,
	CommandReportCookingReviveRes,
	CommandReportCookingCraftReq,
	CommandReportCookingCraftRes,
	CookingCraftErrors,
	CookingCraftError,
	CookingSlotData,
	CraftPetFoodResult,
	CraftMaterialResult
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
import { Materials } from "../database/game/models/Material";
import { PotionDataController } from "../../data/Potion";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getCookingGrade, FURNACE_MAX_USES_PER_DAY, CookingOutputType, CookingOutputTypeValue
} from "../../../../Lib/src/constants/CookingConstants";
import { giveItemToPlayer } from "../utils/ItemUtils";
import { minutesToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

interface PlayerAndHome {
	player: Player;
	home: Home;
	cookingSlots: number;
}

/**
 * Temporary in-memory store for pending wood confirmations.
 * Maps keycloakId → { materialId, rarity, timeout } so that when a player
 * confirms, we know which wood was originally selected.
 * Entries auto-expire after 5 minutes to prevent memory leaks.
 */
const WOOD_CONFIRMATION_TTL = minutesToMilliseconds(5);

interface PendingWoodConfirmation {
	materialId: number;
	rarity: MaterialRarity;
	isRevive: boolean;
}

const pendingWoodConfirmations = new Map<string, PendingWoodConfirmation & {
	timeout: NodeJS.Timeout;
}>();

function setPendingWoodConfirmation(keycloakId: string, materialId: number, rarity: MaterialRarity, isRevive: boolean): void {
	const existing = pendingWoodConfirmations.get(keycloakId);
	if (existing) {
		clearTimeout(existing.timeout);
	}
	const timeout = setTimeout(() => pendingWoodConfirmations.delete(keycloakId), WOOD_CONFIRMATION_TTL);
	pendingWoodConfirmations.set(keycloakId, {
		materialId,
		rarity,
		isRevive,
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
	return {
		materialId: pending.materialId,
		rarity: pending.rarity,
		isRevive: pending.isRevive
	};
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
	furnaceUsesToday: number;
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
		furnaceUsesRemaining: FURNACE_MAX_USES_PER_DAY - params.furnaceUsesToday,
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

	// Check overheat
	if (CookingService.isFurnaceOverheated(player)) {
		response.push(makePacket(CommandReportCookingOverheatRes, {
			overheatUntil: new Date(player.furnaceOverheatUntil!).getTime()
		}));
		return;
	}

	// Get wood
	const wood = await CookingService.getWoodToConsume(player.id);
	if (!wood) {
		response.push(makePacket(CommandReportCookingNoWoodRes, {}));
		return;
	}

	// Non-common wood needs confirmation
	if (wood.needsConfirmation) {
		const isRevive = PacketClass === CommandReportCookingReviveRes;
		setPendingWoodConfirmation(keycloakId, wood.materialId, wood.rarity, isRevive);
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

	// Advance furnace position and increment usage
	player.furnacePosition++;
	await CookingService.incrementFurnaceUsage(player);

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	response.push(buildIgniteOrReviveResponse(PacketClass, {
		slots, woodConsumed: !woodSaved, woodMaterialId: wood.materialId, furnaceUsesToday: player.furnaceUsesToday, cookingLevel: player.cookingLevel
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

	// Advance furnace position and increment usage
	player.furnacePosition++;
	await CookingService.incrementFurnaceUsage(player);

	const slots = await CookingService.getSlotRecipes({
		player, homeId: home.id, cookingSlots
	});
	const ResponseClass = pending.isRevive ? CommandReportCookingReviveRes : CommandReportCookingIgniteRes;
	response.push(buildIgniteOrReviveResponse(ResponseClass, {
		slots, woodConsumed: true, woodMaterialId: pending.materialId, furnaceUsesToday: player.furnaceUsesToday, cookingLevel: player.cookingLevel
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
	inventorySwapPackets?: CrowniclesPacket[];
}

async function handlePotionOutput(
	player: Player,
	recipe: CookingRecipeData,
	context: PacketContext
): Promise<CraftOutputResult> {
	if (recipe.potionNature === undefined || recipe.potionRarity === undefined) {
		return {};
	}
	if (!PotionDataController.instance.hasItemWithNatureAndRarity(recipe.potionNature, recipe.potionRarity)) {
		return {};
	}
	const potion = PotionDataController.instance.randomItem(recipe.potionNature, recipe.potionRarity);
	const itemReceived = await player.giveItem(potion);
	const result: CraftOutputResult = { potionId: potion.id };
	if (!itemReceived) {
		result.inventorySwapPackets = [];
		await giveItemToPlayer(result.inventorySwapPackets, context, player, potion);
	}
	return result;
}

async function handlePetFoodOutput(
	player: Player,
	recipe: CookingRecipeData,
	guild: Guild
): Promise<CraftOutputResult> {
	if (!recipe.petFood) {
		return {};
	}

	const availableSpace = CookingService.getAvailableFoodSpace(guild, recipe.petFood.type);
	const storedQuantity = Math.min(recipe.petFood.quantity, availableSpace);

	if (storedQuantity > 0) {
		guild.addFood(recipe.petFood.type, storedQuantity, NumberChangeReason.COOKING);
		await guild.save();
	}

	const surplus = recipe.petFood.quantity - storedQuantity;
	const surplusResult = surplus > 0
		? await handlePetFoodSurplus(player, recipe, surplus)
		: {};

	return {
		petFood: {
			type: recipe.petFood.type,
			quantity: recipe.petFood.quantity,
			storedQuantity,
			...surplusResult
		}
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

async function handleMaterialOutput(
	player: Player,
	recipe: CookingRecipeData
): Promise<CraftOutputResult> {
	if (recipe.outputMaterialId === undefined || recipe.outputMaterialQuantity === undefined) {
		return {};
	}
	await Materials.giveMaterial(player.id, recipe.outputMaterialId, recipe.outputMaterialQuantity);
	return {
		material: {
			materialId: recipe.outputMaterialId,
			quantity: recipe.outputMaterialQuantity
		}
	};
}

async function handleFailedPotionOutput(
	player: Player,
	context: PacketContext
): Promise<CraftOutputResult> {
	const noEffectPotion = PotionDataController.instance.getById(0);
	if (!noEffectPotion) {
		return {};
	}
	const itemReceived = await player.giveItem(noEffectPotion);
	const result: CraftOutputResult = { failedPotionId: 0 };
	if (!itemReceived) {
		result.inventorySwapPackets = [];
		await giveItemToPlayer(result.inventorySwapPackets, context, player, noEffectPotion);
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
	switch (recipe.outputType) {
		case CookingOutputType.POTION:
			return await handlePotionOutput(player, recipe, context);
		case CookingOutputType.PET_FOOD:
			return guild ? await handlePetFoodOutput(player, recipe, guild) : {};
		case CookingOutputType.MATERIAL:
			return await handleMaterialOutput(player, recipe);
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
