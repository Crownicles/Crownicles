import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
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
	CommandReportCookingCraftRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CookingService } from "../cooking/CookingService";
import { recipeRegistry } from "../cooking/RecipeRegistry";
import {
	Players
} from "../database/game/models/Player";
import {
	Homes
} from "../database/game/models/Home";
import { Materials } from "../database/game/models/Material";
import { PotionDataController } from "../../data/Potion";
import { PetEntities } from "../database/game/models/PetEntity";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getCookingGrade, FURNACE_MAX_USES_PER_DAY
} from "../../../../Lib/src/constants/CookingConstants";

/**
 * Temporary in-memory store for pending wood confirmations.
 * Maps keycloakId → { materialId, rarity } so that when a player
 * confirms, we know which wood was originally selected.
 */
const pendingWoodConfirmations = new Map<string, {
	materialId: number;
	rarity: number;
}>();

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
		cookingGrade: getCookingGrade(cookingLevel).name,
		cookingLevel
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
		pendingWoodConfirmations.set(keycloakId, {
			materialId: wood.materialId,
			rarity: wood.rarity
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
	const pending = pendingWoodConfirmations.get(keycloakId);
	pendingWoodConfirmations.delete(keycloakId);

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
			outputType: "potion",
			cookingXpGained: 0,
			cookingLevelUp: false
		}));
		return response;
	}

	const recipe = recipeRegistry.getById(slot.recipe.id);
	if (!recipe) {
		return response;
	}

	// Verify ingredients are still available
	if (!slot.recipe.canCraft) {
		return response;
	}

	// Execute the craft
	const result = await CookingService.executeCraft(player, recipe, home.id);

	// Determine output
	let potionId: number | undefined;
	let petFoodType: string | undefined;
	let petFoodQuantity: number | undefined;
	let failedPotionId: number | undefined;

	if (result.success && recipe.outputType === "potion" && recipe.potionNature !== undefined && recipe.potionRarity !== undefined) {
		const potion = PotionDataController.instance.randomItem(recipe.potionNature, recipe.potionRarity);
		await player.giveItem(potion);
		potionId = potion.id;
	}
	else if (result.success && recipe.outputType === "petFood" && recipe.petFoodLovePoints !== undefined) {
		petFoodType = recipe.petFoodType;
		petFoodQuantity = recipe.petFoodQuantity;

		// Apply love points to the player's pet if they have one
		if (player.petId) {
			const pet = await PetEntities.getById(player.petId);
			if (pet) {
				await pet.changeLovePoints({
					player,
					amount: recipe.petFoodLovePoints,
					response,
					reason: NumberChangeReason.COOKING
				});
				await pet.save();
			}
		}
	}
	else if (!result.success && recipe.outputType === "potion") {
		// Failed potion — give a no-effect potion (nature 0, rarity 0 = "potion sans effet")
		const noEffectPotion = PotionDataController.instance.getById(0);
		if (noEffectPotion) {
			await player.giveItem(noEffectPotion);
			failedPotionId = 0;
		}
	}

	response.push(makePacket(CommandReportCookingCraftRes, {
		success: result.success,
		recipeId: recipe.id,
		wasSecret: slot.recipe.isSecret,
		outputType: recipe.outputType,
		potionId,
		petFoodType,
		petFoodQuantity,
		failedPotionId,
		cookingXpGained: result.xpGained,
		cookingLevelUp: result.levelUp,
		newCookingLevel: result.newLevel,
		newCookingGrade: result.newGrade,
		materialSaved: result.materialSaved,
		discoveredRecipeIds: result.discoveredRecipeIds
	}));
	return response;
}
