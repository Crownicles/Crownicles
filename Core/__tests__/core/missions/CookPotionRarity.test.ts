import {
	describe, it, expect
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/cookPotionRarity";
import { ItemConstants } from "../../../../Lib/src/constants/ItemConstants";

const EPIC = ItemConstants.RARITY.EPIC;

describe("cookPotionRarity mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant(0 as never, {} as never)).toBe(0);
	});

	it("should never be pre-completed on assignment (action-based)", () => {
		expect(missionInterface.initialNumberDone({} as never, EPIC)).toBe(0);
	});

	it("should always return a null save blob", () => {
		expect(missionInterface.updateSaveBlob(EPIC, null, {})).toBeNull();
	});

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should match when the cooked potion rarity is exactly the threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(EPIC, { rarity: EPIC }, null)).toBe(true);
		});

		it("should match when the cooked potion rarity is above the threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(EPIC, { rarity: ItemConstants.RARITY.LEGENDARY }, null)).toBe(true);
		});

		it("should not match when the cooked potion rarity is below the threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(EPIC, { rarity: EPIC - 1 }, null)).toBe(false);
		});
	});
});
