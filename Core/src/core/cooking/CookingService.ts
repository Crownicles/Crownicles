import Player from "../database/game/models/Player";
import { Materials } from "../database/game/models/Material";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import {
	Guilds, Guild
} from "../database/game/models/Guild";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialDataController } from "../../data/Material";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { getFoodIndexOf } from "../utils/FoodUtils";
import {
	getCookingGrade,
	CookingGradeDefinition,
	PLANT_COOKING_XP,
	MATERIAL_RARITY_COOKING_XP,
	CookingXpConstants,
	FAILURE_LEVEL_OFFSET,
	NO_XP_LEVEL_THRESHOLD,
	FURNACE_MAX_USES_PER_DAY,
	FURNACE_MIN_OVERHEAT_MS,
	CookingOutputType,
	SECRET_RECIPE_PLACEHOLDER
} from "../../../../Lib/src/constants/CookingConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerCookingRecipe } from "../database/game/models/PlayerCookingRecipe";
import {
	getUniqueRecipesForSlots,
	isRecipeSecret
} from "./CookingSlotRotation";
import {
	CookingSlotData, RecipeSlotData
} from "../../../../Lib/src/types/CookingTypes";
import { RecipeDiscoveryService } from "./RecipeDiscoveryService";
import {
	getTomorrowMidnight, getDayNumber
} from "../../../../Lib/src/utils/TimeUtils";

interface MaterialStock {
	materialId: number;
	quantity: number;
}

interface WoodSelection {
	materialId: number;
	rarity: MaterialRarity;
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

interface RecipeSlotContext {
	furnacePosition: number;
	daySeed: number;
	grade: CookingGradeDefinition;
	plantStorageMap: Map<number, number>;
	materialMap: Map<number, number>;
	guild: Guild | null;
}

interface CookingLevelUpResult {
	levelUp: boolean;
	newLevel?: number;
	newGrade?: string;
}

export class CookingService {
	static canStorePetFoodReward(recipe: CookingRecipe, guild: Guild | null): boolean {
		if (recipe.outputType !== CookingOutputType.PET_FOOD) {
			return true;
		}

		if (!guild || !recipe.petFood) {
			return false;
		}

		return !guild.isStorageFullFor(recipe.petFood.type, recipe.petFood.quantity);
	}

	/**
	 * Get wood to consume for furnace, with priority system
	 */
	static async getWoodToConsume(playerId: number): Promise<WoodSelection | null> {
		const playerMaterials = await Materials.getPlayerMaterials(playerId);
		const woodByRarity = CookingService.groupWoodByRarity(playerMaterials);
		return CookingService.selectBestWood(woodByRarity);
	}

	private static groupWoodByRarity(playerMaterials: MaterialStock[]): Map<number, MaterialStock[]> {
		const woodMaterials = MaterialDataController.instance.getMaterialsFromType(MaterialType.WOOD);
		const playerMaterialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));
		const woodByRarity = new Map<number, MaterialStock[]>();

		for (const wood of woodMaterials) {
			const id = parseInt(wood.id, 10);
			const quantity = playerMaterialMap.get(id) ?? 0;
			if (quantity <= 0) {
				continue;
			}
			const existing = woodByRarity.get(wood.rarity) ?? [];
			existing.push({
				materialId: id,
				quantity
			});
			woodByRarity.set(wood.rarity, existing);
		}

		return woodByRarity;
	}

	private static selectBestWood(woodByRarity: Map<number, MaterialStock[]>): WoodSelection | null {
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
			const tomorrow = getTomorrowMidnight();

			const msUntilTomorrow = tomorrow.getTime() - now.getTime();

			player.furnaceOverheatUntil = new Date(
				now.getTime() + Math.max(msUntilTomorrow, FURNACE_MIN_OVERHEAT_MS)
			);
		}

		await player.save();
		return player.furnaceUsesToday >= FURNACE_MAX_USES_PER_DAY;
	}

	/**
	 * Get all slot recipes for the current furnace state
	 */
	static async getSlotRecipes(params: {
		player: Player;
		homeId: number;
		cookingSlots: number;
	}): Promise<CookingSlotData[]> {
		const {
			player, homeId, cookingSlots
		} = params;
		const discoveredIds = await PlayerCookingRecipe.getDiscoveredRecipeIds(player);
		const daySeed = getDayNumber();
		const grade = getCookingGrade(player.cookingLevel);
		const playerMaterials = await Materials.getPlayerMaterials(player.id);
		const materialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));
		const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
		const slotRecipes = getUniqueRecipesForSlots({
			cookingSlots,
			furnacePosition: player.furnacePosition,
			daySeed,
			discoveredRecipeIds: discoveredIds,
			allowPetFoodRecipes: Boolean(guild),
			maxRecipeLevelWithoutPenalty: grade.maxRecipeLevelWithoutPenalty
		});

		// Load all plant storages once to avoid N+1 queries
		const allPlantStorages = await HomePlantStorages.getOfHome(homeId);
		const plantStorageMap = new Map(allPlantStorages.map(s => [s.plantId, s.quantity]));

		const context: RecipeSlotContext = {
			furnacePosition: player.furnacePosition,
			daySeed,
			grade,
			plantStorageMap,
			materialMap,
			guild
		};

		return slotRecipes.map((recipe, i) => ({
			slotIndex: i,
			recipe: recipe ? CookingService.buildRecipeSlotData(i, recipe, context) : null
		}));
	}

	private static buildRecipeSlotData(
		slotIndex: number,
		recipe: CookingRecipe,
		context: RecipeSlotContext
	): RecipeSlotData {
		const secret = isRecipeSecret({
			slotIndex,
			furnacePosition: context.furnacePosition,
			daySeed: context.daySeed,
			secretRate: context.grade.secretRecipeRate
		});

		const plantAvailability = recipe.plants.map(p => ({
			plantId: p.plantId,
			quantity: p.quantity,
			playerHas: context.plantStorageMap.get(p.plantId) ?? 0
		}));

		const materialAvailability = recipe.materials.map(m => ({
			materialId: m.materialId,
			quantity: m.quantity,
			playerHas: context.materialMap.get(m.materialId) ?? 0
		}));

		const hasIngredients = plantAvailability.every(p => p.playerHas >= p.quantity)
			&& materialAvailability.every(m => m.playerHas >= m.quantity);
		const canCraftOutput = recipe.outputType === CookingOutputType.PET_FOOD
			? Boolean(context.guild)
			: true;

		const {
			id, level, outputType, recipeType
		} = recipe;

		return {
			id,
			level,
			outputType,
			recipeType,
			isSecret: secret,
			outputDescription: secret ? SECRET_RECIPE_PLACEHOLDER : id,
			petFoodType: recipe.petFood?.type,
			ingredients: {
				plants: plantAvailability,
				materials: materialAvailability
			},
			canCraft: hasIngredients && canCraftOutput
		};
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
				materialXp += (MATERIAL_RARITY_COOKING_XP[matData.rarity] ?? 0) * mat.quantity;
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
		return grade.failureRate * (FAILURE_LEVEL_OFFSET + recipeLevel);
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
	static async addCookingXp(params: {
		player: Player;
		xp: number;
	}): Promise<CookingLevelUpResult> {
		const {
			player, xp
		} = params;
		player.cookingExperience += xp;

		let levelUp = false;
		let newLevel: number | undefined;
		let newGrade: string | undefined;

		while (player.cookingExperience >= CookingService.getXpNeededForLevel(player.cookingLevel)) {
			player.cookingExperience -= CookingService.getXpNeededForLevel(player.cookingLevel);
			player.cookingLevel++;
			levelUp = true;
			newLevel = player.cookingLevel;
			newGrade = getCookingGrade(player.cookingLevel).id;
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
	static async executeCraft(params: {
		player: Player;
		recipe: CookingRecipe;
		homeId: number;
	}): Promise<CraftResult> {
		const {
			player, recipe, homeId
		} = params;
		const grade = getCookingGrade(player.cookingLevel);

		// Consume plants (batched per plant type)
		for (const plant of recipe.plants) {
			const storage = await HomePlantStorages.getForPlant(homeId, plant.plantId);
			if (storage) {
				storage.quantity = Math.max(0, storage.quantity - plant.quantity);
				await storage.save();
			}
		}

		// Consume materials (with possible material save buff)
		const materialSaved = await CookingService.consumeMaterialsWithSaveBuff({
			playerId: player.id,
			materials: recipe.materials,
			materialSaveChance: grade.materialSaveChance
		});

		// Calculate result and XP
		const success = !RandomUtils.crowniclesRandom.bool(Math.min(CookingService.getFailureRate(grade, recipe.level), 1));
		const xp = CookingService.computeCraftXp({
			success, recipe, grade
		});
		const levelResult = await CookingService.addCookingXp({
			player, xp
		});

		// Discover cooking-level recipes on level up
		const discoveredRecipeIds = levelResult.levelUp
			? (await RecipeDiscoveryService.discoverCookingLevelRecipes(player)).map(r => r.id)
			: [];

		return {
			success,
			xpGained: xp,
			materialSaved,
			...levelResult,
			discoveredRecipeIds
		};
	}

	private static async consumeMaterialsWithSaveBuff(params: {
		playerId: number;
		materials: CookingRecipe["materials"];
		materialSaveChance: number;
	}): Promise<number | undefined> {
		const {
			playerId, materials, materialSaveChance
		} = params;
		let materialSaved: number | undefined;
		const materialsToConsume = [...materials];
		const shouldSaveMaterial = materialSaveChance > 0 && materialsToConsume.length > 0 && RandomUtils.crowniclesRandom.bool(materialSaveChance);

		if (shouldSaveMaterial) {
			const savedIndex = RandomUtils.crowniclesRandom.integer(0, materialsToConsume.length - 1);
			materialSaved = materialsToConsume[savedIndex].materialId;
			materialsToConsume.splice(savedIndex, 1);
		}

		if (materialsToConsume.length > 0) {
			await Materials.consumeMaterials(playerId, materialsToConsume);
		}

		return materialSaved;
	}

	private static computeCraftXp(params: {
		success: boolean;
		recipe: CookingRecipe;
		grade: CookingGradeDefinition;
	}): number {
		const {
			success, recipe, grade
		} = params;
		const levelDiff = recipe.level - grade.maxRecipeLevelWithoutPenalty;
		if (levelDiff >= NO_XP_LEVEL_THRESHOLD) {
			return 0;
		}
		return success
			? CookingService.calculateCookingXp(recipe)
			: CookingService.calculateFailureXp(recipe.level);
	}

	/**
	 * Get available food space in guild for a given food type
	 */
	static getAvailableFoodSpace(guild: Guild, foodType: string): number {
		const foodIndex = getFoodIndexOf(foodType);
		const max = GuildConstants.MAX_PET_FOOD[foodIndex];
		const current = guild.getDataValue(foodType) as number;
		return Math.max(0, max - current);
	}

	/**
	 * Check if the player's pet is hungry and can eat the given food type
	 */
	static async getHungryCompatiblePet(player: Player, foodType: string): Promise<PetEntity | null> {
		if (!player.petId) {
			return null;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			return null;
		}

		const petModel = PetDataController.instance.getById(petEntity.typeId);
		if (!petModel || !petEntity.canBeFed(petModel, foodType)) {
			return null;
		}

		return petEntity;
	}

	/**
	 * Feed the player's pet from surplus cooking food
	 */
	static async feedPetFromSurplus(player: Player, petEntity: PetEntity, foodType: string): Promise<void> {
		const foodIndex = getFoodIndexOf(foodType);
		petEntity.hungrySince = new Date();
		await petEntity.changeLovePoints({
			response: [],
			player,
			amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[foodIndex],
			reason: NumberChangeReason.PET_FEED
		});
		await petEntity.save();
	}

	/**
	 * Get the material to return when recycling surplus pet food.
	 * Returns the first material from the recipe's ingredient list.
	 */
	static getSurplusRecycleMaterial(recipe: CookingRecipe): number | undefined {
		if (recipe.materials.length === 0) {
			return undefined;
		}
		return recipe.materials[0].materialId;
	}
}
