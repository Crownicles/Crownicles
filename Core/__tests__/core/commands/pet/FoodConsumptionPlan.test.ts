import {describe, expect, it} from "vitest";

// Food ration values
const FOOD_RATION_VALUES = {
	commonFood: 1,
	carnivorousFood: 3,
	herbivorousFood: 3,
	ultimateFood: 5
};

type FoodType = "commonFood" | "carnivorousFood" | "herbivorousFood" | "ultimateFood";

interface FoodConsumptionResult {
	treatsUsed: number;
	dietUsed: number;
	soupUsed: number;
	totalRations: number;
}

interface AvailableFood {
	treats: number;
	dietFood: number;
	soup: number;
}

/**
 * Calculate optimal food consumption plan
 * Rules (in order of priority):
 * 1. Never take less than required (unless no stock left)
 * 2. Minimize excess rations
 * 3. When same excess, use priority order: treats > diet food > soup
 */
function calculateOptimalFoodConsumption(
	rationsRequired: number,
	available: AvailableFood,
	dietRationValue: number = 3
): FoodConsumptionResult {
	const soupRationValue = FOOD_RATION_VALUES.ultimateFood;
	const treatRationValue = FOOD_RATION_VALUES.commonFood;

	// Generate all valid combinations that meet or exceed the requirement
	interface Option {
		treats: number;
		diet: number;
		soup: number;
		total: number;
		excess: number;
	}

	const options: Option[] = [];

	// Try all combinations
	const maxTreats = Math.min(available.treats, rationsRequired); // Treats can't exceed requirement (no waste)
	const maxDiet = Math.min(available.dietFood, Math.ceil(rationsRequired / dietRationValue));
	const maxSoup = Math.min(available.soup, Math.ceil(rationsRequired / soupRationValue));

	for (let t = 0; t <= maxTreats; t++) {
		for (let d = 0; d <= maxDiet; d++) {
			for (let s = 0; s <= maxSoup; s++) {
				const total = t * treatRationValue + d * dietRationValue + s * soupRationValue;
				if (total >= rationsRequired) {
					options.push({
						treats: t,
						diet: d,
						soup: s,
						total,
						excess: total - rationsRequired
					});
				}
			}
		}
	}

	// If no valid options, use everything available
	if (options.length === 0) {
		const totalRations = available.treats * treatRationValue
			+ available.dietFood * dietRationValue
			+ available.soup * soupRationValue;
		return {
			treatsUsed: available.treats,
			dietUsed: available.dietFood,
			soupUsed: available.soup,
			totalRations
		};
	}

	// Sort options:
	// 1. By excess (ascending) - minimize waste
	// 2. By treats (descending) - prefer treats
	// 3. By diet (descending) - prefer diet over soup
	options.sort((a, b) => {
		if (a.excess !== b.excess) {
			return a.excess - b.excess;
		}
		if (a.treats !== b.treats) {
			return b.treats - a.treats;
		}
		return b.diet - a.diet;
	});

	const best = options[0];

	return {
		treatsUsed: best.treats,
		dietUsed: best.diet,
		soupUsed: best.soup,
		totalRations: best.total
	};
}

describe("Food Consumption Plan", () => {
	describe("calculateOptimalFoodConsumption", () => {
		it("Scenario 1: 10 required, 4 treats, 0 diet, 3 soup -> should use 2 soup", () => {
			const result = calculateOptimalFoodConsumption(10, {
				treats: 4,
				dietFood: 0,
				soup: 3
			});

			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(2);
			expect(result.totalRations).toBe(10);
		});

		it("Scenario 2: 15 required, 2 treats, 2 diet, 3 soup -> should use 2 treats + 1 diet + 2 soup", () => {
			const result = calculateOptimalFoodConsumption(15, {
				treats: 2,
				dietFood: 2,
				soup: 3
			});

			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(2);
			expect(result.totalRations).toBe(15); // 2 + 3 + 10 = 15
		});

		it("Scenario 3: 3 required, 20 treats, 2 diet, 3 soup -> should use 3 treats", () => {
			const result = calculateOptimalFoodConsumption(3, {
				treats: 20,
				dietFood: 2,
				soup: 3
			});

			expect(result.treatsUsed).toBe(3);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3);
		});

		it("Scenario 4: 5 required, 3 treats, 2 diet, 3 soup -> should use 2 treats + 1 diet", () => {
			const result = calculateOptimalFoodConsumption(5, {
				treats: 3,
				dietFood: 2,
				soup: 3
			});

			// Options with excess 0:
			// - 2 treats + 1 diet = 2 + 3 = 5 (exact match, uses treats = priority)
			// - 1 soup = 5 (exact match, but no treats)
			// Winner: 2 treats + 1 diet (prioritizes treats)
			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(5);
		});

		it("Scenario 5: 2 required, 0 treats, 5 diet, 1 soup -> should use 1 diet", () => {
			const result = calculateOptimalFoodConsumption(2, {
				treats: 0,
				dietFood: 5,
				soup: 1
			});

			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3); // 1 diet = 3 rations (excess 1, but soup would be 5 = excess 3)
		});

		it("Scenario 6: Insufficient food - should use all available", () => {
			const result = calculateOptimalFoodConsumption(100, {
				treats: 2,
				dietFood: 1,
				soup: 1
			});

			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(1);
			expect(result.totalRations).toBe(10); // 2 + 3 + 5 = 10 (not enough)
		});

		it("Scenario 7: Exact match with treats only", () => {
			const result = calculateOptimalFoodConsumption(5, {
				treats: 10,
				dietFood: 2,
				soup: 2
			});

			expect(result.treatsUsed).toBe(5);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(5);
		});

		it("Scenario 8: No treats, prefer diet over soup when equal excess", () => {
			const result = calculateOptimalFoodConsumption(3, {
				treats: 0,
				dietFood: 2,
				soup: 2
			});

			// 1 diet = 3 (excess 0)
			// 1 soup = 5 (excess 2)
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3);
		});

		it("Scenario 9: Complex - 8 required, 2 treats, 1 diet, 2 soup", () => {
			const result = calculateOptimalFoodConsumption(8, {
				treats: 2,
				dietFood: 1,
				soup: 2
			});

			// After 2 treats: need 6 more
			// 1 diet = 3, still need 3 more -> 1 soup = 5 -> total excess = 2
			// 2 diet = 6 (but only 1 available)
			// 1 soup = 5 (excess -1, not enough)
			// 2 soup = 10 (excess 4)
			// 1 diet + 1 soup = 8 (excess 2)
			// Best without treats: 2 soup = 10 (excess 4) or 1 diet + 1 soup = 8 (excess 2)
			// With treats: 2 treats + 1 diet + 1 soup = 2 + 3 + 5 = 10 (excess 2)
			// Actually: 2 treats = 2, need 6 more. 1 diet + 1 soup = 8, total = 10 (excess 2)
			// Or: 0 treats + 1 diet + 1 soup = 8 (exact!)
			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(1);
			expect(result.totalRations).toBe(8);
		});
	});
});
