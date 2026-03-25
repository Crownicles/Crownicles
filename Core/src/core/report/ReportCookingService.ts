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
import { CookingRecipeDataController } from "../../data/CookingRecipeData";
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
	timeout: ReturnType<typeof setTimeout>;
}>();

function setPendingWoodConfirmation(keycloakId: string, materialId: number, rarity: MaterialRarity): void {
	const existing = pendingWoodConfirmations.get(keycloakId);
	if (existing) {
		clearTimeout(existing.timeout);
	}
	const timeout = setTimeout(() => pendingWoodConfirmations.delete(keycloakId), WOOD_CONFIRMATION_TTL_MS);
	pendingWoodConfirmations.set(keycloakId, {
		materialId,
		rarity,
		timeout
	});
}

function consumePendingWoodConfirmation(keycloakId: string): {
	materialId: number;
	rarity: MaterialRarity;
} | undefined {
	const pending = pendingWoodConfirmations.get(keycloakId);
	if (!pending) {
		return undefined;
	}
	clearTimeout(pending.timeout);
	pendingWoodConfirmations.delete(keycloakId);
	return {
		materialId: pending.materialId,
		rarity: pending.rarity
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
	const updatedSlots = await CookingService.getSlotRecipes(params.player, params.homeId, params.cookingSlots);

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
		setPendingWoodConfirmation(keycloakId, wood.materialId, wood.rarity);
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

	const slots = await CookingService.getSlotRecipes(player, home.id, cookingSlots);
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

	const slots = await CookingService.getSlotRecipes(player, home.id, cookingSlots);
	response.push(buildIgniteOrReviveResponse(CommandReportCookingIgniteRes, slots, true, pending.materialId, player.furnaceUsesToday, player.cookingLevel));
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
	const slots = await CookingService.getSlotRecipes(player, home.id, cookingSlots);
	const slot = slots.find(s => s.slotIndex === packet.slotIndex);
	if (!slot?.recipe) {
		response.push(makePacket(CommandReportCookingCraftRes, {
			success: false,
			recipeId: "",
			wasSecret: false,
			outputType: CookingOutputType.POTION,
			cookingXpGained: 0,
			cookingLevelUp: false,
			error: CookingCraftErrors.CRAFT_UNAVAILABLE,
			updatedSlots: slots
		}));
		return response;
	}

	const recipe = CookingRecipeDataController.instance.getById(slot.recipe.id);
	if (!recipe) {
		return response;
	}

	const guild = await CookingService.getPlayerGuild(player);
	if (recipe.outputType === CookingOutputType.PET_FOOD && !guild) {
		response.push(await buildBlockedCraftResponse({
			player,
			homeId: home.id,
			cookingSlots,
			error: CookingCraftErrors.GUILD_REQUIRED,
			recipeId: recipe.id,
			wasSecret: slot.recipe.isSecret,
			outputType: recipe.outputType
		}));
		return response;
	}

	// Verify ingredients are still available
	if (!slot.recipe.canCraft) {
		response.push(await buildBlockedCraftResponse({
			player,
			homeId: home.id,
			cookingSlots,
			error: CookingCraftErrors.CRAFT_UNAVAILABLE,
			recipeId: recipe.id,
			wasSecret: slot.recipe.isSecret,
			outputType: recipe.outputType
		}));
		return response;
	}

	// Execute the craft
	const result = await CookingService.executeCraft(player, recipe, home.id);

	// Determine output
	let potionId: number | undefined;
	let petFoodType: PetFood | undefined;
	let petFoodQuantity: number | undefined;
	let petFoodStoredQuantity: number | undefined;
	let petFedFromSurplus: boolean | undefined;
	let surplusMaterialId: number | undefined;
	let surplusMaterialQuantity: number | undefined;
	let craftedMaterialId: number | undefined;
	let craftedMaterialQuantity: number | undefined;
	let failedPotionId: number | undefined;
	let inventorySwapPackets: CrowniclesPacket[] | undefined;

	if (result.success && recipe.outputType === CookingOutputType.POTION && recipe.potionNature !== undefined && recipe.potionRarity !== undefined) {
		const potion = PotionDataController.instance.randomItem(recipe.potionNature, recipe.potionRarity);
		const itemReceived = await player.giveItem(potion);
		if (!itemReceived) {
			inventorySwapPackets = [];
			await giveItemToPlayer(inventorySwapPackets, context, player, potion);
		}
		potionId = potion.id;
	}
	else if (result.success && recipe.outputType === CookingOutputType.PET_FOOD && recipe.petFoodType !== undefined && recipe.petFoodQuantity !== undefined && guild) {
		petFoodType = recipe.petFoodType;
		petFoodQuantity = recipe.petFoodQuantity;

		// Calculate how much can actually be stored in guild
		const availableSpace = CookingService.getAvailableFoodSpace(guild, recipe.petFoodType);
		const storedQuantity = Math.min(recipe.petFoodQuantity, availableSpace);
		petFoodStoredQuantity = storedQuantity;

		if (storedQuantity > 0) {
			guild.addFood(recipe.petFoodType, storedQuantity, NumberChangeReason.COOKING);
			await guild.save();
		}

		// Handle surplus
		let surplus = recipe.petFoodQuantity - storedQuantity;
		if (surplus > 0) {
			// Try to feed player's pet if hungry and compatible
			const hungryPet = await CookingService.getHungryCompatiblePet(player, recipe.petFoodType);
			if (hungryPet) {
				await CookingService.feedPetFromSurplus(player, hungryPet, recipe.petFoodType);
				petFedFromSurplus = true;
				surplus--;
			}

			// Remaining surplus is recycled into materials
			if (surplus > 0) {
				const recycleMaterialId = CookingService.getSurplusRecycleMaterial(recipe);
				if (recycleMaterialId !== undefined) {
					await Materials.giveMaterial(player.id, recycleMaterialId, surplus);
					surplusMaterialId = recycleMaterialId;
					surplusMaterialQuantity = surplus;
				}
			}
		}
	}
	else if (result.success && recipe.outputType === CookingOutputType.MATERIAL && recipe.outputMaterialId !== undefined && recipe.outputMaterialQuantity !== undefined) {
		await Materials.giveMaterial(player.id, recipe.outputMaterialId, recipe.outputMaterialQuantity);
		craftedMaterialId = recipe.outputMaterialId;
		craftedMaterialQuantity = recipe.outputMaterialQuantity;
	}
	else if (!result.success && recipe.outputType === CookingOutputType.POTION) {
		// Failed potion — give a no-effect potion (nature 0, rarity 0 = "potion sans effet")
		const noEffectPotion = PotionDataController.instance.getById(0);
		if (noEffectPotion) {
			const itemReceived = await player.giveItem(noEffectPotion);
			if (!itemReceived) {
				inventorySwapPackets = [];
				await giveItemToPlayer(inventorySwapPackets, context, player, noEffectPotion);
			}
			failedPotionId = 0;
		}
	}

	const updatedSlots = await CookingService.getSlotRecipes(player, home.id, cookingSlots);

	response.push(makePacket(CommandReportCookingCraftRes, {
		success: result.success,
		recipeId: recipe.id,
		wasSecret: slot.recipe.isSecret,
		outputType: recipe.outputType,
		potionId,
		petFoodType,
		petFoodQuantity,
		petFoodStoredQuantity,
		petFedFromSurplus,
		surplusMaterialId,
		surplusMaterialQuantity,
		craftedMaterialId,
		craftedMaterialQuantity,
		failedPotionId,
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
