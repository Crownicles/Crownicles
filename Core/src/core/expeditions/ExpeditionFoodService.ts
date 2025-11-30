import { Pet } from "../../data/Pet";
import Player from "../database/game/models/Player";
import { Guilds } from "../database/game/models/Guild";

/**
 * Food types with their ration values
 * Priority order: commonFood (treats) > carnivorousFood/herbivorousFood > ultimateFood (soup)
 */
export type FoodType = "commonFood" | "carnivorousFood" | "herbivorousFood" | "ultimateFood";

export const FOOD_RATION_VALUES: Record<FoodType, number> = {
	commonFood: 1,
	carnivorousFood: 3,
	herbivorousFood: 3,
	ultimateFood: 5
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
 * Calculate default combination using all available food
 */
function calculateDefaultCombination(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues
): BestCombination {
	const { treatVal, dietVal, soupVal } = values;
	return {
		t: available.treats,
		d: available.diet,
		s: available.soup,
		excess: (available.treats * treatVal + available.diet * dietVal + available.soup * soupVal) - rationsRequired
	};
}

/**
 * Try to find a better combination with a specific number of treats
 */
function tryTreatsCombination(
	available: AvailableFood,
	rationsRequired: number,
	treatsCount: number,
	values: FoodRationValues,
	currentBest: BestCombination
): BestCombination {
	const { treatVal, dietVal, soupVal } = values;
	let best = currentBest;
	const rem = rationsRequired - treatsCount * treatVal;

	if (rem <= 0) {
		// Treats alone are enough
		const excess = -rem;
		if (excess < best.excess || (excess === best.excess && treatsCount > best.t)) {
			best = {
				t: treatsCount,
				d: 0,
				s: 0,
				excess
			};
		}
		return best;
	}

	// Need diet/soup. Check soup range [minSoup, minSoup + 2]
	const minSoup = Math.max(0, Math.ceil((rem - available.diet * dietVal) / soupVal));

	if (minSoup > available.soup) {
		return best;
	}

	for (let soupCount = minSoup; soupCount <= Math.min(available.soup, minSoup + 2); soupCount++) {
		const remAfterSoup = rem - soupCount * soupVal;
		const dietCount = Math.max(0, Math.ceil(remAfterSoup / dietVal));

		if (dietCount > available.diet) {
			continue;
		}

		const currentExcess = (treatsCount * treatVal + dietCount * dietVal + soupCount * soupVal) - rationsRequired;

		if (currentExcess < best.excess) {
			best = {
				t: treatsCount,
				d: dietCount,
				s: soupCount,
				excess: currentExcess
			};
		}

		if (currentExcess === 0) {
			break;
		}
	}

	return best;
}

/**
 * Find the optimal food combination that minimizes excess while respecting priority
 * Priority: treats > diet food > soup
 */
function findOptimalCombination(
	available: AvailableFood,
	rationsRequired: number,
	values: FoodRationValues
): BestCombination {
	const { treatVal } = values;

	// Default to using everything if we can't meet requirements
	let best = calculateDefaultCombination(available, rationsRequired, values);

	// If we don't have enough to meet requirements, return default
	if (best.excess < 0) {
		return best;
	}

	// Iterate treats from max down to 0 to prioritize treats
	for (let treatsCount = Math.min(available.treats, rationsRequired); treatsCount >= 0; treatsCount--) {
		best = tryTreatsCombination(available, rationsRequired, treatsCount, values, best);

		if (best.excess === 0 && best.t === treatsCount) {
			break; // Found optimal
		}
	}

	return best;
}

/**
 * Build consumption plan from the best combination found
 */
function buildConsumptionPlan(
	best: BestCombination,
	dietFoodType: FoodType,
	values: FoodRationValues
): FoodConsumptionPlan {
	const { treatVal, dietVal, soupVal } = values;
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
 * Priority: treats > meat/salad (based on diet) > soup
 * Minimizes excess rations while respecting priority order
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

	const available: AvailableFood = {
		treats: guild.commonFood,
		diet: guild[dietFoodType],
		soup: guild.ultimateFood
	};

	const best = findOptimalCombination(available, rationsRequired, values);

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
