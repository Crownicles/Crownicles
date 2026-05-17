import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { computeEffectivePotionRarity } from "../../../src/core/report/ReportCookingService";
import { PotionDataController } from "../../../src/data/Potion";
import {
	ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";

describe("computeEffectivePotionRarity", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the upgraded rarity when bonus is true and the upgraded item exists", () => {
		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockReturnValue(true);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.RARE, true);
		expect(result).toBe(ItemRarity.RARE + 1);
	});

	it("returns the base rarity when bonus is false", () => {
		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockReturnValue(true);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.RARE, false);
		expect(result).toBe(ItemRarity.RARE);
	});

	it("caps at MYTHICAL when bonus is true and base is already MYTHICAL", () => {
		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockReturnValue(true);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.MYTHICAL, true);
		expect(result).toBe(ItemRarity.MYTHICAL);
	});

	it("falls back to base rarity when upgraded rarity has no item", () => {
		const spy = vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockImplementation((_nature, rarity) => rarity === ItemRarity.RARE);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.RARE, true);
		expect(result).toBe(ItemRarity.RARE);
		expect(spy).toHaveBeenCalled();
	});

	it("returns null when no item exists even for the base rarity", () => {
		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockReturnValue(false);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.RARE, false);
		expect(result).toBeNull();
	});

	it("returns null when bonus is true but no item exists for either rarity", () => {
		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity")
			.mockReturnValue(false);

		const result = computeEffectivePotionRarity(ItemNature.HEALTH, ItemRarity.RARE, true);
		expect(result).toBeNull();
	});
});
