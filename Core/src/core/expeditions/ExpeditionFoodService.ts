import { Pet } from "../../data/Pet";
import Player from "../database/game/models/Player";
import { Guilds } from "../database/game/models/Guild";
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";

/**
 * Food types with their ration values
 * Priority order is now based on cost per ration: treats (cheapest) > diet food > soup (most expensive)
 */
export type FoodType = "commonFood" | "carnivorousFood" | "herbivorousFood" | "ultimateFood";

export const FOOD_RATION_VALUES: Record<FoodType, number> = {
	commonFood: 1,
	carnivorousFood: 3,
	herbivorousFood: 3,
	ultimateFood: 5
};

/**
 * Food prices per unit (from GuildShopConstants.PRICES.FOOD)
 * Index: 0=commonFood, 1=herbivorousFood, 2=carnivorousFood, 3=ultimateFood
 */
export const FOOD_PRICES: Record<FoodType, number> = {
	commonFood: GuildShopConstants.PRICES.FOOD[0],
	herbivorousFood: GuildShopConstants.PRICES.FOOD[1],
	carnivorousFood: GuildShopConstants.PRICES.FOOD[2],
	ultimateFood: GuildShopConstants.PRICES.FOOD[3]
};

/**
 * Food consumption plan for an expedition
 */
export interface FoodConsumptionPlan {
	totalRations: number;
	consumption: {
		foodType: FoodType;
		itemsToConsume: number;
		rationsProvided: number;
	}[];
}

/**
 * Available food stock from guild storage
 */
interface AvailableFood {
	treats: number;
	diet: number;
	soup: number;
}

/**
 * Best food combination found during optimization
 */
interface BestCombination {
	t: number; // treats
	d: number; // diet food
	s: number; // soup
	excess: number;
	cost: number;
}

/**
 * Food ration values for optimization
 */
interface FoodRationValues {
	treatVal: number;
	dietVal: number;
	soupVal: number;
}

/**
 * Food prices for optimization
 */
interface FoodPriceValues {
	treatPrice: number;
	dietPrice: number;
	soupPrice: number;
}

/**
 * Option for food combination during optimization
 */
interface FoodOption {
	t: number;
	d: number;
	s: number;
	total: number;
	excess: number;
	cost: number;
}

/**
 * Calculate the combination when all available food should be used (not enough food)
 */
function calculateAllFoodCombination(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues,
	prices: FoodPriceValues
): BestCombination {
	const totalAvailable = available.treats * values.treatVal
		+ available.diet * values.dietVal
		+ available.soup * values.soupVal;
	const totalCost = available.treats * prices.treatPrice
		+ available.diet * prices.dietPrice
		+ available.soup * prices.soupPrice;
	return {
		t: available.treats,
		d: available.diet,
		s: available.soup,
		excess: totalAvailable - rationsRequired,
		cost: totalCost
	};
}

/**
 * Evaluate a single food combination and return it if valid, or null if insufficient
 */
function evaluateCombination(
	t: number,
	d: number,
	s: number,
	rationsRequired: number,
	values: FoodRationValues,
	prices: FoodPriceValues
): FoodOption | null {
	const total = t * values.treatVal + d * values.dietVal + s * values.soupVal;
	if (total < rationsRequired) {
		return null;
	}
	const cost = t * prices.treatPrice + d * prices.dietPrice + s * prices.soupPrice;
	return {
		t, d, s, total, excess: total - rationsRequired, cost
	};
}

/**
 * Generate all valid food combinations that meet or exceed the required rations
 */
function generateValidCombinations(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues,
	prices: FoodPriceValues
): FoodOption[] {
	const options: FoodOption[] = [];

	// Limit the search space - treats can't exceed what's needed for exact match
	const maxTreats = Math.min(available.treats, rationsRequired);
	const maxDiet = Math.min(available.diet, Math.ceil(rationsRequired / values.dietVal));
	const maxSoup = Math.min(available.soup, Math.ceil(rationsRequired / values.soupVal));

	for (let t = 0; t <= maxTreats; t++) {
		for (let d = 0; d <= maxDiet; d++) {
			for (let s = 0; s <= maxSoup; s++) {
				const option = evaluateCombination(t, d, s, rationsRequired, values, prices);
				if (option) {
					options.push(option);
				}
			}
		}
	}

	return options;
}

/**
 * Sort options by excess first, then by cost
 */
function sortByExcessThenCost(a: FoodOption, b: FoodOption): number {
	if (a.excess !== b.excess) {
		return a.excess - b.excess;
	}
	return a.cost - b.cost;
}

/**
 * Check if there is enough food available to meet the requirement
 */
function hasEnoughFood(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues
): boolean {
	const totalAvailable = available.treats * values.treatVal
		+ available.diet * values.dietVal
		+ available.soup * values.soupVal;
	return totalAvailable >= rationsRequired;
}

/**
 * Find the optimal food combination that minimizes excess first, then cost
 * This uses a brute-force approach to find the cheapest combination that meets requirements
 */
function findOptimalCombination(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues,
	prices: FoodPriceValues
): BestCombination {
	// If we don't have enough food, return everything we have
	if (!hasEnoughFood(available, rationsRequired, values)) {
		return calculateAllFoodCombination(available, rationsRequired, values, prices);
	}

	// Generate all valid combinations that meet or exceed the requirement
	const options = generateValidCombinations(available, rationsRequired, values, prices);

	// Sort options: minimize excess first, then minimize cost
	options.sort(sortByExcessThenCost);

	const best = options[0];
	return {
		t: best.t,
		d: best.d,
		s: best.s,
		excess: best.excess,
		cost: best.cost
	};
}

/**
 * Build consumption plan from the best combination found
 */
function buildConsumptionPlan(
	best: BestCombination,
	dietFoodType: FoodType,
	values: FoodRationValues
): FoodConsumptionPlan {
	const {
		treatVal, dietVal, soupVal
	} = values;
	const plan: FoodConsumptionPlan = {
		totalRations: 0,
		consumption: []
	};

	if (best.t > 0) {
		plan.consumption.push({
			foodType: "commonFood",
			itemsToConsume: best.t,
			rationsProvided: best.t * treatVal
		});
		plan.totalRations += best.t * treatVal;
	}

	if (best.d > 0) {
		plan.consumption.push({
			foodType: dietFoodType,
			itemsToConsume: best.d,
			rationsProvided: best.d * dietVal
		});
		plan.totalRations += best.d * dietVal;
	}

	if (best.s > 0) {
		plan.consumption.push({
			foodType: "ultimateFood",
			itemsToConsume: best.s,
			rationsProvided: best.s * soupVal
		});
		plan.totalRations += best.s * soupVal;
	}

	return plan;
}

/**
 * Calculate the optimal food consumption plan for an expedition
 * Minimizes excess rations first, then minimizes total cost
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

	const dietFoodType: FoodType = petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
	const values: FoodRationValues = {
		treatVal: FOOD_RATION_VALUES.commonFood,
		dietVal: FOOD_RATION_VALUES[dietFoodType],
		soupVal: FOOD_RATION_VALUES.ultimateFood
	};

	const prices: FoodPriceValues = {
		treatPrice: FOOD_PRICES.commonFood,
		dietPrice: FOOD_PRICES[dietFoodType],
		soupPrice: FOOD_PRICES.ultimateFood
	};

	const available: AvailableFood = {
		treats: guild.commonFood,
		diet: guild[dietFoodType],
		soup: guild.ultimateFood
	};

	const best = findOptimalCombination(available, rationsRequired, values, prices);

	return buildConsumptionPlan(best, dietFoodType, values);
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
