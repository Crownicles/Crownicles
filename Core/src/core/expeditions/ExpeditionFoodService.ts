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
 * Find the optimal food combination that minimizes excess while respecting priority
 * Priority: treats > diet food > soup
 */
function findOptimalCombination(
	available: AvailableFood,
	rationsRequired: number,
	treatVal: number,
	dietVal: number,
	soupVal: number
): BestCombination {
	// Default to using everything if we can't meet requirements
	let best: BestCombination = {
		t: available.treats,
		d: available.diet,
		s: available.soup,
		excess: (available.treats * treatVal + available.diet * dietVal + available.soup * soupVal) - rationsRequired
	};

	// If we don't have enough to meet requirements, return default
	if (best.excess < 0) {
		return best;
	}

	// Iterate treats from max down to 0 to prioritize treats
	for (let t = Math.min(available.treats, rationsRequired); t >= 0; t--) {
		const rem = rationsRequired - t * treatVal;

		if (rem <= 0) {
			// Treats alone are enough
			const excess = -rem;
			if (excess < best.excess || (excess === best.excess && t > best.t)) {
				best = {
					t,
					d: 0,
					s: 0,
					excess
				};
			}
			if (excess === 0) {
				break; // Optimal found (0 excess, max treats)
			}
			continue;
		}

		/*
		 * Need diet/soup. We want to minimize soup (Diet > Soup priority).
		 * We only need to check s in range [minSoup, minSoup + 2] to cover modulo 3 cases.
		 */
		const minSoup = Math.max(0, Math.ceil((rem - available.diet * dietVal) / soupVal));

		if (minSoup > available.soup) {
			continue; // Cannot satisfy with this t
		}

		// Check s, s+1, s+2
		for (let s = minSoup; s <= Math.min(available.soup, minSoup + 2); s++) {
			const remAfterSoup = rem - s * soupVal;
			const d = Math.max(0, Math.ceil(remAfterSoup / dietVal));

			if (d > available.diet) {
				continue;
			}

			const currentExcess = (t * treatVal + d * dietVal + s * soupVal) - rationsRequired;

			/*
			 * Compare with best.
			 * Priority: Minimize Excess > Maximize Treats > Maximize Diet (Minimize Soup)
			 */
			if (currentExcess < best.excess) {
				best = {
					t,
					d,
					s,
					excess: currentExcess
				};
			}

			if (currentExcess === 0) {
				break;
			}
		}

		if (best.excess === 0 && best.t === t) {
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
	treatVal: number,
	dietVal: number,
	soupVal: number
): FoodConsumptionPlan {
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
	const treatVal = FOOD_RATION_VALUES.commonFood;
	const dietVal = FOOD_RATION_VALUES[dietFoodType];
	const soupVal = FOOD_RATION_VALUES.ultimateFood;

	const available: AvailableFood = {
		treats: guild.commonFood,
		diet: guild[dietFoodType],
		soup: guild.ultimateFood
	};

	const best = findOptimalCombination(available, rationsRequired, treatVal, dietVal, soupVal);

	return buildConsumptionPlan(best, dietFoodType, treatVal, dietVal, soupVal);
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
