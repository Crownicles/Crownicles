import {describe, expect, it, vi, beforeEach} from "vitest";
import {calculateFoodConsumptionPlan} from "../../../../src/core/expeditions/ExpeditionFoodService";
import {Guilds} from "../../../../src/core/database/game/models/Guild";
import Player from "../../../../src/core/database/game/models/Player";
import {Pet} from "../../../../src/data/Pet";
import {PetConstants} from "../../../../../Lib/src/constants/PetConstants";

// Mock the Guilds module
vi.mock("../../../../src/core/database/game/models/Guild", () => ({
	Guilds: {
		getById: vi.fn()
	}
}));

/**
 * Helper to create a mock player
 */
function createMockPlayer(guildId: number | null): Player {
	return { guildId } as Player;
}

/**
 * Helper to create a mock pet
 */
function createMockPet(canEatMeat: boolean): Pet {
	return {
		canEatMeat: () => canEatMeat
	} as Pet;
}

/**
 * Helper to create a mock guild with food stocks
 */
function createMockGuild(commonFood: number, carnivorousFood: number, herbivorousFood: number, ultimateFood: number) {
	return {
		commonFood,
		carnivorousFood,
		herbivorousFood,
		ultimateFood
	};
}

/**
 * Helper to extract consumption values from plan
 */
function extractConsumption(plan: Awaited<ReturnType<typeof calculateFoodConsumptionPlan>>, dietFoodType: "carnivorousFood" | "herbivorousFood") {
	return {
		treatsUsed: plan.consumption.find(c => c.foodType === "commonFood")?.itemsToConsume ?? 0,
		dietUsed: plan.consumption.find(c => c.foodType === dietFoodType)?.itemsToConsume ?? 0,
		soupUsed: plan.consumption.find(c => c.foodType === "ultimateFood")?.itemsToConsume ?? 0,
		totalRations: plan.totalRations
	};
}

describe("Food Consumption Plan", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("calculateFoodConsumptionPlan", () => {
		it("Scenario 1: 10 required, 4 treats, 0 diet, 3 soup -> should use 2 soup", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(4, 0, 0, 3) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				10
			);
			const result = extractConsumption(plan, "carnivorousFood");

			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(2);
			expect(result.totalRations).toBe(10);
		});

		it("Scenario 2: 15 required, 2 treats, 2 diet, 3 soup -> should use 2 treats + 1 diet + 2 soup", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(2, 2, 2, 3) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				15
			);
			const result = extractConsumption(plan, "carnivorousFood");

			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(2);
			expect(result.totalRations).toBe(15);
		});

		it("Scenario 3: 3 required, 20 treats, 2 diet, 3 soup -> should use 3 treats", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(20, 2, 2, 3) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				3
			);
			const result = extractConsumption(plan, "carnivorousFood");

			expect(result.treatsUsed).toBe(3);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3);
		});

		it("Scenario 4: 5 required, 3 treats, 2 diet, 3 soup -> should use 2 treats + 1 diet (cheapest)", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(3, 2, 2, 3) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				5
			);
			const result = extractConsumption(plan, "carnivorousFood");

			// 2 treats + 1 diet = 5 (cost: 40 + 250 = 290)
			// 1 soup = 5 (cost: 600)
			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(5);
		});

		it("Scenario 5: 2 required, 0 treats, 5 diet, 1 soup -> should use 1 diet", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(0, 5, 5, 1) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				2
			);
			const result = extractConsumption(plan, "carnivorousFood");

			// 1 diet = 3 rations (excess 1, cost 250)
			// 1 soup = 5 rations (excess 3, cost 600)
			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3);
		});

		it("Scenario 6: Insufficient food - should use all available", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(2, 1, 1, 1) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				100
			);
			const result = extractConsumption(plan, "carnivorousFood");

			expect(result.treatsUsed).toBe(2);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(1);
			expect(result.totalRations).toBe(10); // 2 + 3 + 5 = 10
		});

		it("Scenario 7: Exact match with treats only", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(10, 2, 2, 2) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				5
			);
			const result = extractConsumption(plan, "carnivorousFood");

			expect(result.treatsUsed).toBe(5);
			expect(result.dietUsed).toBe(0);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(5);
		});

		it("Scenario 8: No treats, prefer diet over soup (lower excess)", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(0, 2, 2, 2) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				3
			);
			const result = extractConsumption(plan, "carnivorousFood");

			// 1 diet = 3 (excess 0, cost 250)
			// 1 soup = 5 (excess 2, cost 600)
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(3);
		});

		it("Scenario 9: Complex - 8 required, 2 treats, 1 diet, 2 soup -> should use 1 diet + 1 soup", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(2, 1, 1, 2) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				8
			);
			const result = extractConsumption(plan, "carnivorousFood");

			// 0 treats + 1 diet + 1 soup = 0 + 3 + 5 = 8 (exact match)
			expect(result.treatsUsed).toBe(0);
			expect(result.dietUsed).toBe(1);
			expect(result.soupUsed).toBe(1);
			expect(result.totalRations).toBe(8);
		});

		it("Scenario 10: Cheapest combination - 25 required, 12 treats, 5 diet, 5 soup -> should use 10 treats + 5 diet", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(12, 5, 5, 5) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				25
			);
			const result = extractConsumption(plan, "carnivorousFood");

			// 10 treats + 5 diet = 10 + 15 = 25 (cost: 200 + 1250 = 1450)
			// 12 treats + 1 diet + 2 soup = 12 + 3 + 10 = 25 (cost: 240 + 250 + 1200 = 1690)
			expect(result.treatsUsed).toBe(10);
			expect(result.dietUsed).toBe(5);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(25);
		});

		it("Scenario 11: Works with herbivorous food type", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(createMockGuild(5, 0, 3, 2) as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(false), // Herbivorous pet
				10
			);
			const result = extractConsumption(plan, "herbivorousFood");

			// 4 treats + 2 diet = 4 + 6 = 10 (cost: 80 + 500 = 580)
			expect(result.treatsUsed).toBe(4);
			expect(result.dietUsed).toBe(2);
			expect(result.soupUsed).toBe(0);
			expect(result.totalRations).toBe(10);
		});

		it("should return empty plan when player has no guild", async () => {
			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(null),
				createMockPet(true),
				10
			);

			expect(plan.totalRations).toBe(0);
			expect(plan.consumption).toHaveLength(0);
		});

		it("should return empty plan when guild is not found", async () => {
			vi.mocked(Guilds.getById).mockResolvedValue(null as never);

			const plan = await calculateFoodConsumptionPlan(
				createMockPlayer(1),
				createMockPet(true),
				10
			);

			expect(plan.totalRations).toBe(0);
			expect(plan.consumption).toHaveLength(0);
		});

		it("should use PET_FOOD_LOVE_POINTS_AMOUNT constants correctly", () => {
			expect(PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[0]).toBe(1);
			expect(PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[2]).toBe(3);
			expect(PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[1]).toBe(3);
			expect(PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[3]).toBe(5);
		});
	});
});
