import { Pet } from "../../data/Pet";
import Player from "../database/game/models/Player";
import {
	Guild, Guilds
} from "../database/game/models/Guild";
import {
	PetConstants, PetFood
} from "../../../../Lib/src/constants/PetConstants";
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";

/**
 * Re-export PetFood as FoodType for backward compatibility
 */
export type FoodType = PetFood;

/**
 * Configuration for a single food type - organized by food, not by characteristic
 */
interface FoodConfig {
	readonly type: FoodType;
	readonly rations: number;
	readonly price: number;
}

/**
 * All food types configuration indexed by type
 * Uses existing constants from PetConstants and GuildShopConstants
 */
const FOOD_CONFIG_MAP: Record<FoodType, FoodConfig> = {
	[PetConstants.PET_FOOD.COMMON_FOOD]: {
		type: PetConstants.PET_FOOD.COMMON_FOOD,
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[0],
		price: GuildShopConstants.PRICES.FOOD[0]
	},
	[PetConstants.PET_FOOD.HERBIVOROUS_FOOD]: {
		type: PetConstants.PET_FOOD.HERBIVOROUS_FOOD,
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[1],
		price: GuildShopConstants.PRICES.FOOD[1]
	},
	[PetConstants.PET_FOOD.CARNIVOROUS_FOOD]: {
		type: PetConstants.PET_FOOD.CARNIVOROUS_FOOD,
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[2],
		price: GuildShopConstants.PRICES.FOOD[2]
	},
	[PetConstants.PET_FOOD.ULTIMATE_FOOD]: {
		type: PetConstants.PET_FOOD.ULTIMATE_FOOD,
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[3],
		price: GuildShopConstants.PRICES.FOOD[3]
	}
};

/**
 * Get the diet food type based on whether the pet can eat meat
 */
export function getDietFoodType(petModel: Pet): FoodType {
	return petModel.canEatMeat() ? PetConstants.PET_FOOD.CARNIVOROUS_FOOD : PetConstants.PET_FOOD.HERBIVOROUS_FOOD;
}

/**
 * Item in a food consumption plan
 */
export interface FoodConsumptionItem {
	foodType: FoodType;
	itemsToConsume: number;
	rationsProvided: number;
}

/**
 * Food consumption plan for an expedition
 */
export interface FoodConsumptionPlan {
	totalRations: number;
	consumption: FoodConsumptionItem[];
}

/**
 * Internal representation of available food with its config
 */
interface AvailableFoodSlot {
	config: FoodConfig;
	available: number;
}

/**
 * Candidate combination of food items
 */
interface FoodCombination {
	treats: number;
	diet: number;
	soup: number;
	totalRations: number;
	totalCost: number;
	excess: number;
}

/**
 * Get available food slots for a pet from guild storage
 * Returns [treats, diet, soup] in order
 */
function getAvailableFoodSlots(guild: Guild, dietType: FoodType): [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot] {
	return [
		{
			config: FOOD_CONFIG_MAP.commonFood,
			available: guild.commonFood
		},
		{
			config: FOOD_CONFIG_MAP[dietType],
			available: guild[dietType]
		},
		{
			config: FOOD_CONFIG_MAP.ultimateFood,
			available: guild.ultimateFood
		}
	];
}

/**
 * Food amounts for a combination evaluation
 */
interface FoodAmounts {
	treats: number;
	diet: number;
	soup: number;
}

/**
 * Context for evaluating food combinations
 */
interface FoodEvaluationContext {
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot];
	rationsRequired: number;
}

/**
 * Calculate rations and cost for a combination
 */
function evaluateCombination(amounts: FoodAmounts, context: FoodEvaluationContext): FoodCombination {
	const {
		treats, diet, soup
	} = amounts;
	const {
		slots, rationsRequired
	} = context;

	const totalRations = treats * slots[0].config.rations
		+ diet * slots[1].config.rations
		+ soup * slots[2].config.rations;

	const totalCost = treats * slots[0].config.price
		+ diet * slots[1].config.price
		+ soup * slots[2].config.price;

	return {
		treats,
		diet,
		soup,
		totalRations,
		totalCost,
		excess: totalRations - rationsRequired
	};
}

/**
 * Compare two combinations: prefer lower excess, then lower cost
 */
function isBetterCombination(candidate: FoodCombination, current: FoodCombination): boolean {
	if (candidate.excess < current.excess) {
		return true;
	}
	return candidate.excess === current.excess && candidate.totalCost < current.totalCost;
}

/**
 * Calculate the minimum treats needed for a given soup and diet combination
 */
function calculateTreatsNeeded(
	remainingRations: number,
	treatSlot: AvailableFoodSlot
): number | null {
	const treatsNeeded = remainingRations > 0
		? Math.ceil(remainingRations / treatSlot.config.rations)
		: 0;

	// Return null if we need more treats than available
	return treatsNeeded <= treatSlot.available ? treatsNeeded : null;
}

/**
 * Try a combination and update best if it's better
 */
function tryAndUpdateBest(
	amounts: FoodAmounts,
	evalContext: FoodEvaluationContext,
	current: FoodCombination | null
): FoodCombination | null {
	const candidate = evaluateCombination(amounts, evalContext);

	// Only consider combinations that meet the requirement
	if (candidate.totalRations < evalContext.rationsRequired) {
		return current;
	}

	if (current === null || isBetterCombination(candidate, current)) {
		return candidate;
	}
	return current;
}

/**
 * Find optimal food combination that minimizes excess first, then cost.
 *
 * Algorithm: Smart bounded iteration
 * For each amount of soup (0 to min(available, ceil(required/soupRations)))
 * For each amount of diet (0 to min(available, ceil(remaining/dietRations)))
 * Calculate exact treats needed (with rounding up)
 * If valid, evaluate and compare
 *
 * Complexity: O(S * D) where S = soup items needed, D = diet items needed
 * In practice, this is very small (typically < 10 * 10 = 100 iterations max)
 * Much better than the original O(T * D * S) brute-force with T up to required rations
 */
function findOptimalCombination(
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot],
	rationsRequired: number
): FoodCombination {
	const [
		treatSlot,
		dietSlot,
		soupSlot
	] = slots;
	const evalContext: FoodEvaluationContext = {
		slots, rationsRequired
	};

	// Calculate total available rations
	const totalAvailableRations = treatSlot.available * treatSlot.config.rations
		+ dietSlot.available * dietSlot.config.rations
		+ soupSlot.available * soupSlot.config.rations;

	// If not enough food, return all available
	if (totalAvailableRations < rationsRequired) {
		return evaluateCombination(
			{
				treats: treatSlot.available, diet: dietSlot.available, soup: soupSlot.available
			},
			evalContext
		);
	}

	// Bound search space intelligently
	const maxSoup = Math.min(soupSlot.available, Math.ceil(rationsRequired / soupSlot.config.rations));
	const maxDiet = Math.min(dietSlot.available, Math.ceil(rationsRequired / dietSlot.config.rations));

	let best: FoodCombination | null = null;

	// Iterate all valid combinations
	for (let soup = 0; soup <= maxSoup; soup++) {
		const remainingAfterSoup = rationsRequired - soup * soupSlot.config.rations;

		for (let diet = 0; diet <= maxDiet; diet++) {
			const remainingAfterDiet = remainingAfterSoup - diet * dietSlot.config.rations;
			const treatsNeeded = calculateTreatsNeeded(remainingAfterDiet, treatSlot);

			if (treatsNeeded !== null) {
				best = tryAndUpdateBest({
					treats: treatsNeeded, diet, soup
				}, evalContext, best);
			}
		}
	}

	// Fallback (should not happen if totalAvailable >= required)
	return best ?? evaluateCombination({
		treats: 0, diet: 0, soup: 0
	}, evalContext);
}

/**
 * Build consumption plan from a combination
 */
function buildPlanFromCombination(
	combination: FoodCombination,
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot]
): FoodConsumptionPlan {
	const plan: FoodConsumptionPlan = {
		totalRations: combination.totalRations,
		consumption: []
	};

	if (combination.treats > 0) {
		plan.consumption.push({
			foodType: slots[0].config.type,
			itemsToConsume: combination.treats,
			rationsProvided: combination.treats * slots[0].config.rations
		});
	}

	if (combination.diet > 0) {
		plan.consumption.push({
			foodType: slots[1].config.type,
			itemsToConsume: combination.diet,
			rationsProvided: combination.diet * slots[1].config.rations
		});
	}

	if (combination.soup > 0) {
		plan.consumption.push({
			foodType: slots[2].config.type,
			itemsToConsume: combination.soup,
			rationsProvided: combination.soup * slots[2].config.rations
		});
	}

	return plan;
}

/**
 * Calculate the optimal food consumption plan for an expedition.
 * Minimizes excess rations first, then minimizes total cost.
 *
 * Uses a smart bounded iteration algorithm that is efficient for typical expedition food costs.
 */
export async function calculateFoodConsumptionPlan(
	player: Player,
	petModel: Pet,
	rationsRequired: number
): Promise<FoodConsumptionPlan> {
	const emptyPlan: FoodConsumptionPlan = {
		totalRations: 0,
		consumption: []
	};

	if (!player.guildId) {
		return emptyPlan;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return emptyPlan;
	}

	const dietType = getDietFoodType(petModel);
	const slots = getAvailableFoodSlots(guild, dietType);
	const optimal = findOptimalCombination(slots, rationsRequired);

	return buildPlanFromCombination(optimal, slots);
}

/**
 * Apply the food consumption plan to the guild storage
 */
export async function applyFoodConsumptionPlan(guildId: number, plan: FoodConsumptionPlan): Promise<void> {
	if (plan.consumption.length === 0) {
		return;
	}

	const guild = await Guilds.getById(guildId);
	if (!guild) {
		return;
	}

	for (const item of plan.consumption) {
		guild[item.foodType] -= item.itemsToConsume;
	}

	await guild.save();
}

/**
 * Calculate total available rations in a guild for a specific pet's diet
 */
export function calculateTotalAvailableRations(guild: Guild, petModel: Pet): number {
	const dietType = getDietFoodType(petModel);
	return guild.commonFood * FOOD_CONFIG_MAP.commonFood.rations
		+ guild[dietType] * FOOD_CONFIG_MAP[dietType].rations
		+ guild.ultimateFood * FOOD_CONFIG_MAP.ultimateFood.rations;
}
