import {
	describe, it, expect
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/reachCookingLevel";

describe("reachCookingLevel mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant(0 as never, {} as never)).toBe(0);
	});

	it("should always match variant and blob (progress driven by numberDone)", () => {
		expect(missionInterface.areParamsMatchingVariantAndBlob(0, {}, null)).toBe(true);
	});

	it("should always return a null save blob", () => {
		expect(missionInterface.updateSaveBlob(0, null, {})).toBeNull();
	});

	describe("initialNumberDone", () => {
		it("should start already at the player's current cooking level", () => {
			expect(missionInterface.initialNumberDone({ cookingLevel: 35 } as never, 0)).toBe(35);
		});

		it("should be zero for a player who has not cooked yet", () => {
			expect(missionInterface.initialNumberDone({ cookingLevel: 0 } as never, 0)).toBe(0);
		});
	});
});
