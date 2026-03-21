import Player from "../database/game/models/Player";
import { Materials } from "../database/game/models/Material";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialDataController } from "../../data/Material";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	getCookingGrade,
	CookingGradeDefinition,
	PLANT_COOKING_XP,
	MATERIAL_RARITY_COOKING_XP,
	CookingXpConstants,
	FAILURE_PENALTY_BASE,
	FURNACE_MAX_USES_PER_DAY,
	FURNACE_MIN_OVERHEAT_HOURS,
	SLOT_CONFIGS
} from "../../../../Lib/src/constants/CookingConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerCookingRecipe } from "../database/game/models/PlayerCookingRecipe";
import {
	getRecipeForSlot,
	isRecipeSecret,
	getCurrentDaySeed
} from "./CookingSlotRotation";
import { CookingSlotData } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { RecipeDiscoveryService } from "./RecipeDiscoveryService";

interface WoodSelection {
	materialId: number;
	rarity: number;
	needsConfirmation: boolean;
}

interface CraftResult {
	success: boolean;
	xpGained: number;
	materialSaved: number | undefined;
	levelUp: boolean;
	newLevel: number | undefined;
	newGrade: string | undefined;
	discoveredRecipeIds: string[];
}

export class CookingService {
	/**
	 * Get wood to consume for furnace, with priority system
	 */
	static async getWoodToConsume(playerId: number): Promise<WoodSelection | null> {
		const playerMaterials = await Materials.getPlayerMaterials(playerId);
		const woodMaterials = MaterialDataController.instance.getMaterialsFromType(MaterialType.WOOD);

		// Group wood by rarity
		const woodByRarity = new Map<number, {
			materialId: number;
			quantity: number;
		}[]>();
		for (const wood of woodMaterials) {
			const id = parseInt(wood.id, 10);
			const playerMat = playerMaterials.find(m => m.materialId === id);
			if (playerMat && playerMat.quantity > 0) {
				const existing = woodByRarity.get(wood.rarity) ?? [];
				existing.push({
					materialId: id,
					quantity: playerMat.quantity
				});
				woodByRarity.set(wood.rarity, existing);
			}
		}

		// Priority: Common (1) → Uncommon (2) → Rare (3)
		for (const rarity of [
			MaterialRarity.COMMON,
			MaterialRarity.UNCOMMON,
			MaterialRarity.RARE
		]) {
			const available = woodByRarity.get(rarity);
			if (available && available.length > 0) {
				// Pick the one with the highest stock
				available.sort((a, b) => b.quantity - a.quantity);
				return {
					materialId: available[0].materialId,
					rarity,
					needsConfirmation: rarity !== MaterialRarity.COMMON
				};
			}
		}

		return null;
	}

	/**
	 * Check if furnace is overheated
	 */
	static isFurnaceOverheated(player: Player): boolean {
		if (!player.furnaceOverheatUntil) {
			return false;
		}
		return new Date() < new Date(player.furnaceOverheatUntil);
	}

	/**
	 * Reset daily furnace counter if day changed
	 */
	static async resetDailyCounterIfNeeded(player: Player): Promise<void> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (!player.furnaceLastUseDate || new Date(player.furnaceLastUseDate) < today) {
			player.furnaceUsesToday = 0;
			player.furnaceLastUseDate = new Date();
			await player.save();
		}
	}

	/**
	 * Increment furnace usage and trigger overheat if limit reached
	 */
	static async incrementFurnaceUsage(player: Player): Promise<boolean> {
		await CookingService.resetDailyCounterIfNeeded(player);

		player.furnaceUsesToday++;
		player.furnaceLastUseDate = new Date();

		if (player.furnaceUsesToday >= FURNACE_MAX_USES_PER_DAY) {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(0, 0, 0, 0);

			const msUntilTomorrow = tomorrow.getTime() - now.getTime();
			const minOverheatMs = FURNACE_MIN_OVERHEAT_HOURS * 60 * 60 * 1000;

			player.furnaceOverheatUntil = new Date(
				now.getTime() + Math.max(msUntilTomorrow, minOverheatMs)
			);
		}

		await player.save();
		return player.furnaceUsesToday >= FURNACE_MAX_USES_PER_DAY;
	}

	/**
	 * Get all slot recipes for the current furnace state
	 */
	static async getSlotRecipes(
		player: Player,
		homeId: number,
		cookingSlots: number
	): Promise<CookingSlotData[]> {
		const discoveredIds = await PlayerCookingRecipe.getDiscoveredRecipeIds(player);
		const daySeed = getCurrentDaySeed();
		const grade = getCookingGrade(player.cookingLevel);
		const playerMaterials = await Materials.getPlayerMaterials(player.id);
		const materialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));

		const slots: CookingSlotData[] = [];

		for (let i = 0; i < cookingSlots && i < SLOT_CONFIGS.length; i++) {
			const recipe = getRecipeForSlot(i, player.furnacePosition, daySeed, discoveredIds);
			if (!recipe) {
				slots.push({
					slotIndex: i,
					recipe: null
				});
				continue;
			}

			const secret = isRecipeSecret(i, player.furnacePosition, daySeed, grade.secretRecipeRate);

			// Check ingredient availability
			const plantAvailability = await Promise.all(
				recipe.plants.map(async p => {
					const storage = await HomePlantStorages.getForPlant(homeId, p.plantId);
					return {
						plantId: p.plantId,
						quantity: p.quantity,
						playerHas: storage?.quantity ?? 0
					};
				})
			);

			const materialAvailability = recipe.materials.map(m => ({
				materialId: m.materialId,
				quantity: m.quantity,
				playerHas: materialMap.get(m.materialId) ?? 0
			}));

			const canCraft = plantAvailability.every(p => p.playerHas >= p.quantity)
				&& materialAvailability.every(m => m.playerHas >= m.quantity);

			slots.push({
				slotIndex: i,
				recipe: {
					id: recipe.id,
					level: recipe.level,
					isSecret: secret,
					outputDescription: secret ? "???" : recipe.id,
					ingredients: {
						plants: plantAvailability,
						materials: materialAvailability
					},
					canCraft
				}
			});
		}

		return slots;
	}

	/**
	 * Calculate cooking XP for a recipe
	 */
	static calculateCookingXp(recipe: CookingRecipe): number {
		let plantXp = 0;
		for (const plant of recipe.plants) {
			plantXp += (PLANT_COOKING_XP[plant.plantId] ?? 0) * plant.quantity;
		}

		let materialXp = 0;
		for (const mat of recipe.materials) {
			const matData = MaterialDataController.instance.getById(mat.materialId.toString());
			if (matData) {
				materialXp += MATERIAL_RARITY_COOKING_XP[matData.rarity] ?? 0;
			}
		}

		return Math.round(
			plantXp * CookingXpConstants.PLANT_WEIGHT + materialXp * CookingXpConstants.MATERIAL_WEIGHT
		);
	}

	/**
	 * Calculate failure XP (fixed amount per recipe level)
	 */
	static calculateFailureXp(recipeLevel: number): number {
		return CookingXpConstants.FAILURE_XP_PER_LEVEL * recipeLevel;
	}

	/**
	 * Calculate effective failure rate based on grade and recipe level
	 */
	static getFailureRate(grade: CookingGradeDefinition, recipeLevel: number): number {
		if (recipeLevel <= grade.maxRecipeLevelWithoutPenalty) {
			return grade.failureRate;
		}
		return grade.failureRate * (FAILURE_PENALTY_BASE + recipeLevel);
	}

	/**
	 * Get XP needed for a cooking level
	 */
	static getXpNeededForLevel(level: number): number {
		return Math.round(
			Constants.XP.BASE_VALUE * Math.pow(Constants.XP.COEFFICIENT, level + 1)
		) - Constants.XP.MINUS;
	}

	/**
	 * Add cooking XP to player, handle level up
	 */
	static async addCookingXp(player: Player, xp: number): Promise<{
		levelUp: boolean;
		newLevel?: number;
		newGrade?: string;
	}> {
		player.cookingExperience += xp;

		let levelUp = false;
		let newLevel: number | undefined;
		let newGrade: string | undefined;

		while (player.cookingExperience >= CookingService.getXpNeededForLevel(player.cookingLevel)) {
			player.cookingExperience -= CookingService.getXpNeededForLevel(player.cookingLevel);
			player.cookingLevel++;
			levelUp = true;
			newLevel = player.cookingLevel;
			newGrade = getCookingGrade(player.cookingLevel).name;
		}

		await player.save();
		return {
			levelUp,
			newLevel,
			newGrade
		};
	}

	/**
	 * Execute a craft: consume ingredients, calculate result, give XP
	 */
	static async executeCraft(
		player: Player,
		recipe: CookingRecipe,
		homeId: number
	): Promise<CraftResult> {
		const grade = getCookingGrade(player.cookingLevel);

		// Consume plants
		for (const plant of recipe.plants) {
			for (let i = 0; i < plant.quantity; i++) {
				await HomePlantStorages.removePlant(homeId, plant.plantId);
			}
		}

		// Consume materials (with possible material save buff)
		let materialSaved: number | undefined;
		const materialsToConsume = [...recipe.materials];

		if (grade.materialSaveChance > 0 && materialsToConsume.length > 0) {
			if (RandomUtils.crowniclesRandom.bool(grade.materialSaveChance)) {
				const savedIndex = RandomUtils.crowniclesRandom.integer(0, materialsToConsume.length - 1);
				materialSaved = materialsToConsume[savedIndex].materialId;
				materialsToConsume.splice(savedIndex, 1);
			}
		}

		if (materialsToConsume.length > 0) {
			await Materials.consumeMaterials(player.id, materialsToConsume);
		}

		// Calculate failure
		const failureRate = CookingService.getFailureRate(grade, recipe.level);
		const success = !RandomUtils.crowniclesRandom.bool(Math.min(failureRate, 1));

		// Calculate XP
		const xp = success
			? CookingService.calculateCookingXp(recipe)
			: CookingService.calculateFailureXp(recipe.level);

		const levelResult = await CookingService.addCookingXp(player, xp);

		// Discover cooking-level recipes on level up
		let discoveredRecipeIds: string[] = [];
		if (levelResult.levelUp) {
			const discovered = await RecipeDiscoveryService.discoverCookingLevelRecipes(player);
			discoveredRecipeIds = discovered.map(r => r.id);
		}

		return {
			success,
			xpGained: xp,
			materialSaved,
			levelUp: levelResult.levelUp,
			newLevel: levelResult.newLevel,
			newGrade: levelResult.newGrade,
			discoveredRecipeIds
		};
	}
}
