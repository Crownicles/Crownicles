import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/upgradeEpicItemLevel5";
import { ItemConstants } from "../../../../Lib/src/constants/ItemConstants";

describe("upgradeEpicItemLevel5 mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		it("should match an epic item reaching level 5", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { rarity: ItemConstants.RARITY.EPIC, newLevel: 5 }, null as unknown as Buffer)).toBe(true);
		});

		it("should match a more-than-epic item beyond level 5", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { rarity: ItemConstants.RARITY.LEGENDARY, newLevel: 6 }, null as unknown as Buffer)).toBe(true);
		});

		it("should not match an item below epic rarity", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { rarity: ItemConstants.RARITY.EPIC - 1, newLevel: 5 }, null as unknown as Buffer)).toBe(false);
		});

		it("should not match an epic item below level 5", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { rarity: ItemConstants.RARITY.EPIC, newLevel: 4 }, null as unknown as Buffer)).toBe(false);
		});
	});
});
