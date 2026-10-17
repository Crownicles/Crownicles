import {
	describe, it, expect, vi, beforeEach
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/plantSeed";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";

const player = { id: 1 } as never;

describe("plantSeed mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant(0 as never, player)).toBe(0);
	});

	it("should always match variant and blob", () => {
		expect(missionInterface.areParamsMatchingVariantAndBlob(0, {}, null)).toBe(true);
	});

	it("should always return null save blob", () => {
		expect(missionInterface.updateSaveBlob(0, null, {})).toBeNull();
	});

	describe("initialNumberDone", () => {
		beforeEach(() => {
			vi.restoreAllMocks();
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeGardenSlots, "getOfHome").mockResolvedValue([]);
		});

		it("should validate when a seed is already planted", async () => {
			vi.spyOn(HomeGardenSlots, "getOfHome").mockResolvedValue([
				{ isEmpty: () => false } as never
			]);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should not validate when the garden is empty", async () => {
			vi.spyOn(HomeGardenSlots, "getOfHome").mockResolvedValue([
				{ isEmpty: () => true } as never
			]);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should not validate when the player has no home", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
			expect(HomeGardenSlots.getOfHome).not.toHaveBeenCalled();
		});
	});
});