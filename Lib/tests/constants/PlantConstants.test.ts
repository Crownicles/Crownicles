import { describe, it, expect } from "vitest";
import { PlantConstants, PlantId, PLANT_TYPES } from "../../src/constants/PlantConstants";

describe("PlantConstants", () => {
	describe("getHerbalistPrice", () => {
		it("should return a positive price for all plants", () => {
			for (const plant of PLANT_TYPES) {
				const price = PlantConstants.getHerbalistPrice(plant);
				expect(price).toBeGreaterThan(0);
			}
		});

		it("should return deterministic prices for the same day", () => {
			const plant = PLANT_TYPES[0];
			const price1 = PlantConstants.getHerbalistPrice(plant, 0);
			const price2 = PlantConstants.getHerbalistPrice(plant, 0);
			expect(price1).toBe(price2);
		});

		it("should vary prices with day offset", () => {
			const plant = PLANT_TYPES[0];
			const prices = new Set<number>();
			for (let offset = 0; offset < 30; offset++) {
				prices.add(PlantConstants.getHerbalistPrice(plant, offset));
			}
			expect(prices.size).toBeGreaterThan(1);
		});
	});

	describe("lootRandomPlant", () => {
		it("should always return a valid PlantId", () => {
			const mockRandom = { integer: (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min };
			for (let i = 0; i < 100; i++) {
				const plantId = PlantConstants.lootRandomPlant(mockRandom);
				expect(plantId).toBeGreaterThanOrEqual(PlantId.COMMON_HERB);
				expect(plantId).toBeLessThanOrEqual(PlantId.ANCIENT_TREE);
			}
		});

		it("should return COMMON_HERB when roll is 0", () => {
			const mockRandom = { integer: (): number => 0 };
			expect(PlantConstants.lootRandomPlant(mockRandom)).toBe(PlantId.COMMON_HERB);
		});
	});

	describe("getWeeklyHerbalistPlants", () => {
		it("should return exactly 3 plants", () => {
			const plants = PlantConstants.getWeeklyHerbalistPlants();
			expect(plants).toHaveLength(3);
		});

		it("should return deterministic plants for the same date", () => {
			const date = new Date("2026-03-24");
			const plants1 = PlantConstants.getWeeklyHerbalistPlants(date);
			const plants2 = PlantConstants.getWeeklyHerbalistPlants(date);
			expect(plants1.map(p => p.id)).toEqual(plants2.map(p => p.id));
		});

		it("should return plants from different tiers", () => {
			const date = new Date("2026-03-24");
			const plants = PlantConstants.getWeeklyHerbalistPlants(date);
			const tier1Ids = PlantConstants.HERBALIST_TIERS[0];
			const tier2Ids = PlantConstants.HERBALIST_TIERS[1];
			const tier3Ids = PlantConstants.HERBALIST_TIERS[2];

			expect(tier1Ids).toContain(plants[0].id);
			expect(tier2Ids).toContain(plants[1].id);
			expect(tier3Ids).toContain(plants[2].id);
		});

		it("should change plants across different weeks", () => {
			const allPlantSets = new Set<string>();
			for (let week = 0; week < 52; week++) {
				const date = new Date(2026, 0, 1 + week * 7);
				const plants = PlantConstants.getWeeklyHerbalistPlants(date);
				allPlantSets.add(plants.map(p => p.id).join(","));
			}
			expect(allPlantSets.size).toBeGreaterThan(1);
		});
	});

	describe("getPlantById", () => {
		it("should return undefined for id 0", () => {
			expect(PlantConstants.getPlantById(0)).toBeUndefined();
		});

		it("should return the correct plant for valid ids", () => {
			const plant = PlantConstants.getPlantById(PlantId.COMMON_HERB);
			expect(plant).toBeDefined();
			expect(plant!.id).toBe(PlantId.COMMON_HERB);
		});
	});

	describe("hasHomeStorageLink", () => {
		it("should link the plant inventory to the home only with the last tanner upgrade", () => {
			expect(PlantConstants.hasHomeStorageLink(PlantConstants.DEFAULT_PLANT_SLOTS)).toBe(false);
			expect(PlantConstants.hasHomeStorageLink(PlantConstants.MAX_PLANT_SLOTS - 1)).toBe(false);
			expect(PlantConstants.hasHomeStorageLink(PlantConstants.MAX_PLANT_SLOTS)).toBe(true);
		});
	});

	describe("getHerbalistAmounts", () => {
		it("should still sell one plant when none can be received or afforded", () => {
			expect(PlantConstants.getHerbalistAmounts(0)).toEqual([1]);
			expect(PlantConstants.getHerbalistAmounts(1)).toEqual([1]);
		});

		it("should offer 1, 5 and 10 below the largest quantity the player can buy, then that quantity", () => {
			expect(PlantConstants.getHerbalistAmounts(2)).toEqual([1, 2]);
			expect(PlantConstants.getHerbalistAmounts(7)).toEqual([1, 5, 7]);
			expect(PlantConstants.getHerbalistAmounts(10)).toEqual([1, 5, 10]);
			expect(PlantConstants.getHerbalistAmounts(53)).toEqual([1, 5, 10, 53]);
		});

		it("should never offer more than 4 quantities so that they fit next to the cancel button", () => {
			for (let maxAmount = 0; maxAmount <= 100; maxAmount++) {
				const amounts = PlantConstants.getHerbalistAmounts(maxAmount);
				expect(amounts.length).toBeLessThanOrEqual(4);
				expect(new Set(amounts).size).toBe(amounts.length);
				expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
			}
		});
	});
});
