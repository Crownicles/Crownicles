import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetFood } from "../../../../Lib/src/types/PetFood";
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
	CookingCraftError
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CookingService } from "../cooking/CookingService";
import {
	CookingRecipeData, CookingRecipeDataController
} from "../../data/CookingRecipeData";
import {
	Players
} from "../database/game/models/Player";
import {
	Homes
} from "../database/game/models/Home";
import { Materials } from "../database/game/models/Material";
import { PotionDataController } from "../../data/Potion";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getCookingGrade, FURNACE_MAX_USES_PER_DAY, CookingOutputType, CookingOutputTypeValue
} from "../../../../Lib/src/constants/CookingConstants";
import { giveItemToPlayer } from "../utils/ItemUtils";

/**
 * Temporary in-memory store for pending wood confirmations.
 * Maps keycloakId → { materialId, rarity, timeout } so that when a player
 * confirms, we know which wood was originally selected.
 * Entries auto-expire after 5 minutes to prevent memory leaks.
 */
const WOOD_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const pendingWoodConfirmations = new Map<string, {
	materialId: number;
	rarity: MaterialRarity;
	isRevive: boolean;
	timeout: ReturnType<typeof setTimeout>;
}>();

function setPendingWoodConfirmation(keycloakId: string, materialId: number, rarity: MaterialRarity, isRevive: boolean): void {
	const existing = pendingWoodConfirmations.get(keycloakId);
	if (existing) {
		clearTimeout(existing.timeout);
	}
	const timeout = setTimeout(() => pendingWoodConfirmations.delete(keycloakId), WOOD_CONFIRMATION_TTL_MS);
	pendingWoodConfirmations.set(keycloakId, {
		materialId,
		rarity,
		isRevive,
		timeout
	});
}

function consumePendingWoodConfirmation(keycloakId: string): {
	materialId: number;
	rarity: MaterialRarity;
	isRevive: boolean;
} | undefined {
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

async function getPlayerAndHome(keycloakId: string): Promise<{
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>;
	home: NonNullable<Awaited<ReturnType<typeof Homes.getOfPlayer>>>;
	cookingSlots: number;
} | null> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return null;
	}
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return null;
	}
	const homeLevel = home.getLevel();
	if (!homeLevel || homeLevel.features.cookingSlots <= 0) {
		return null;
	}
	return {
		player,
		home,
		cookingSlots: homeLevel.features.cookingSlots
	};
}

function buildIgniteOrReviveResponse(
	PacketClass: typeof CommandReportCookingIgniteRes | typeof CommandReportCookingReviveRes,
	slots: Awaited<ReturnType<typeof CookingService.getSlotRecipes>>,
	woodConsumed: boolean,
	woodMaterialId: number,
	furnaceUsesToday: number,
	cookingLevel: number
): CommandReportCookingIgniteRes | CommandReportCookingReviveRes {
	return makePacket(PacketClass, {
		slots,
		woodConsumed,
		woodMaterialId,
		furnaceUsesRemaining: FURNACE_MAX_USES_PER_DAY - furnaceUsesToday,
		cookingGrade: getCookingGrade(cookingLevel).id,
		cookingLevel
	});
}

async function buildBlockedCraftResponse(params: {
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>;
	homeId: number;
	cookingSlots: number;
	error: CookingCraftError;
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutputTypeValue;
}): Promise<CommandReportCookingCraftRes> {
	const updatedSlots = await CookingService.getSlotRecipes({
		player: params.player,
		homeId: params.homeId,
		cookingSlots: params.cookingSlots
	});

	return makePacket(CommandReportCookingCraftRes, {
		success: false,
		recipeId: params.recipeId,
		wasSecret: params.wasSecret,
		outputType: params.outputType,
		cookingXpGained: 0,
		cookingLevelUp: false,
		error: params.error,
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
	response.push(buildIgniteOrReviveResponse(PacketClass, slots, !woodSaved, wood.materialId, player.furnaceUsesToday, player.cookingLevel));
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
	response.push(buildIgniteOrReviveResponse(ResponseClass, slots, true, pending.materialId, player.furnaceUsesToday, player.cookingLevel));
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
	petFoodType?: PetFood;
	petFoodQuantity?: number;
	petFoodStoredQuantity?: number;
	petFedFromSurplus?: boolean;
	surplusMaterialId?: number;
	surplusMaterialQuantity?: number;
	craftedMaterialId?: number;
	craftedMaterialQuantity?: number;
	failedPotionId?: number;
	inventorySwapPackets?: CrowniclesPacket[];
}

async function handlePotionOutput(
	context: PacketContext,
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>,
	recipe: CookingRecipeData
): Promise<CraftOutputResult> {
	if (recipe.potionNature === undefined || recipe.potionRarity === undefined) {
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
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>,
	recipe: CookingRecipeData,
	guild: NonNullable<Awaited<ReturnType<typeof CookingService.getPlayerGuild>>>
): Promise<CraftOutputResult> {
	if (recipe.petFoodType === undefined || recipe.petFoodQuantity === undefined) {
		return {};
	}

	const availableSpace = CookingService.getAvailableFoodSpace(guild, recipe.petFoodType);
	const storedQuantity = Math.min(recipe.petFoodQuantity, availableSpace);

	if (storedQuantity > 0) {
		guild.addFood(recipe.petFoodType, storedQuantity, NumberChangeReason.COOKING);
		await guild.save();
	}

	const surplus = recipe.petFoodQuantity - storedQuantity;
	const surplusResult = surplus > 0
		? await handlePetFoodSurplus(player, recipe, surplus)
		: {};

	return {
		petFoodType: recipe.petFoodType,
		petFoodQuantity: recipe.petFoodQuantity,
		petFoodStoredQuantity: storedQuantity,
		...surplusResult
	};
}

async function handlePetFoodSurplus(
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>,
	recipe: CookingRecipeData,
	surplus: number
): Promise<Partial<CraftOutputResult>> {
	const result: Partial<CraftOutputResult> = {};
	let remaining = surplus;

	const hungryPet = await CookingService.getHungryCompatiblePet(player, recipe.petFoodType!);
	if (hungryPet) {
		await CookingService.feedPetFromSurplus(player, hungryPet, recipe.petFoodType!);
		result.petFedFromSurplus = true;
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
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>,
	recipe: CookingRecipeData
): Promise<CraftOutputResult> {
	if (recipe.outputMaterialId === undefined || recipe.outputMaterialQuantity === undefined) {
		return {};
	}
	await Materials.giveMaterial(player.id, recipe.outputMaterialId, recipe.outputMaterialQuantity);
	return {
		craftedMaterialId: recipe.outputMaterialId,
		craftedMaterialQuantity: recipe.outputMaterialQuantity
	};
}

async function handleFailedPotionOutput(
	context: PacketContext,
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>
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
	player: NonNullable<Awaited<ReturnType<typeof Players.getByKeycloakId>>>;
	recipe: CookingRecipeData;
	result: { success: boolean };
	guild: Awaited<ReturnType<typeof CookingService.getPlayerGuild>>;
}

function processSuccessfulCraftOutput(
	context: PacketContext,
	player: CraftOutputParams["player"],
	recipe: CookingRecipeData,
	guild: CraftOutputParams["guild"]
): Promise<CraftOutputResult> | CraftOutputResult {
	switch (recipe.outputType) {
		case CookingOutputType.POTION:
			return handlePotionOutput(context, player, recipe);
		case CookingOutputType.PET_FOOD:
			return guild ? handlePetFoodOutput(player, recipe, guild) : {};
		case CookingOutputType.MATERIAL:
			return handleMaterialOutput(player, recipe);
		default:
			return {};
	}
}

function processFailedCraftOutput(
	context: PacketContext,
	player: CraftOutputParams["player"],
	recipe: CookingRecipeData
): Promise<CraftOutputResult> | CraftOutputResult {
	if (recipe.outputType === CookingOutputType.POTION) {
		return handleFailedPotionOutput(context, player);
	}
	return {};
}

function processCraftOutput({
	context,
	player,
	recipe,
	result,
	guild
}: CraftOutputParams): Promise<CraftOutputResult> | CraftOutputResult {
	if (!result.success) {
		return processFailedCraftOutput(context, player, recipe);
	}
	return processSuccessfulCraftOutput(context, player, recipe, guild);
}

function getCraftErrorInfo(
	slot: Awaited<ReturnType<typeof CookingService.getSlotRecipes>>[number] | undefined,
	recipe: CookingRecipeData | undefined
): {
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutputTypeValue;
} {
	return {
		recipeId: recipe?.id ?? "",
		wasSecret: slot?.recipe?.isSecret ?? false,
		outputType: recipe?.outputType ?? CookingOutputType.POTION
	};
}

function validateCraftRequest(
	slot: Awaited<ReturnType<typeof CookingService.getSlotRecipes>>[number] | undefined,
	recipe: CookingRecipeData | undefined,
	guild: Awaited<ReturnType<typeof CookingService.getPlayerGuild>>
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
	context: PacketContext,
	keycloakId: string,
	packet: CommandReportCookingCraftReq
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
	const guild = await CookingService.getPlayerGuild(player);

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
	const {
		inventorySwapPackets, ...outputFields
	} = await processCraftOutput({
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
		...outputFields,
		cookingXpGained: result.xpGained,
		cookingLevelUp: result.levelUp,
		newCookingLevel: result.newLevel,
		newCookingGrade: result.newGrade,
		materialSaved: result.materialSaved,
		discoveredRecipeIds: result.discoveredRecipeIds,
		updatedSlots
	}));
	if (inventorySwapPackets) {
		response.push(...inventorySwapPackets);
	}
	return response;
}
