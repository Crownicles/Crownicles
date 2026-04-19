import { describe, expect, it } from "vitest";
import { BlacksmithConstants } from "../../src/constants/BlacksmithConstants";
import {
	getDisenchantPrice, getMaterialsPurchasePrice, getUpgradePrice
} from "../../src/utils/BlacksmithUtils";
import { ItemRarity } from "../../src/constants/ItemConstants";
import { MaterialRarity } from "../../src/types/MaterialRarity";

describe("BlacksmithUtils", () => {
	describe("getUpgradePrice", () => {
		it("should increase price for rarities above EPIC", () => {
			const epicPrice = getUpgradePrice(1, ItemRarity.EPIC);
			const legendaryPrice = getUpgradePrice(1, ItemRarity.LEGENDARY);
			const mythicalPrice = getUpgradePrice(1, ItemRarity.MYTHICAL);

			expect(legendaryPrice).toBeGreaterThan(epicPrice);
			expect(mythicalPrice).toBeGreaterThan(legendaryPrice);
		});

		it("should decrease price for rarities below EPIC", () => {
			const epicPrice = getUpgradePrice(1, ItemRarity.EPIC);
			const rarePrice = getUpgradePrice(1, ItemRarity.RARE);
			const commonPrice = getUpgradePrice(1, ItemRarity.COMMON);

			expect(rarePrice).toBeLessThan(epicPrice);
			expect(commonPrice).toBeLessThan(rarePrice);
		});

		it("should always return a positive integer", () => {
			for (const level of [1, 2, 3, 4] as const) {
				for (const rarity of Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[]) {
					const price = getUpgradePrice(level, rarity);
					expect(price).toBeGreaterThan(0);
					expect(Number.isInteger(price)).toBe(true);
				}
			}
		});

		it("should increase price with higher target levels", () => {
			const rarity = ItemRarity.EPIC;
			const price1 = getUpgradePrice(1, rarity);
			const price2 = getUpgradePrice(2, rarity);
			const price3 = getUpgradePrice(3, rarity);
			const price4 = getUpgradePrice(4, rarity);

			expect(price2).toBeGreaterThan(price1);
			expect(price3).toBeGreaterThan(price2);
			expect(price4).toBeGreaterThan(price3);
		});
	});

	describe("getMaterialsPurchasePrice", () => {
		it("should return 0 for empty materials array", () => {
			expect(getMaterialsPurchasePrice([])).toBe(0);
		});

		it("should return base price for a single material of quantity 1", () => {
			const price = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			expect(price).toBe(BlacksmithConstants.MATERIAL_BASE_PRICE[MaterialRarity.COMMON]);
		});

		it("should increase price for multiple materials (bulk pricing)", () => {
			const singlePrice = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			const doublePrice = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 2 }
			]);

			// Second material should cost more than the first
			expect(doublePrice).toBeGreaterThan(singlePrice * 2 - 1);
		});

		it("should apply increasing bulk pricing across different rarities", () => {
			const price = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 },
				{ rarity: MaterialRarity.RARE, quantity: 1 }
			]);

			const commonBase = BlacksmithConstants.MATERIAL_BASE_PRICE[MaterialRarity.COMMON];
			const rareBase = BlacksmithConstants.MATERIAL_BASE_PRICE[MaterialRarity.RARE];

			// The second material has a 10% increase
			const expectedRarePrice = Math.round(rareBase * (1 + BlacksmithConstants.MATERIAL_BULK_PRICE_INCREASE_PERCENT / 100));
			expect(price).toBe(commonBase + expectedRarePrice);
		});

		it("should return higher prices for rarer materials", () => {
			const commonPrice = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			const uncommonPrice = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.UNCOMMON, quantity: 1 }
			]);
			const rarePrice = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.RARE, quantity: 1 }
			]);

			expect(uncommonPrice).toBeGreaterThan(commonPrice);
			expect(rarePrice).toBeGreaterThan(uncommonPrice);
		});

		it("should return integer values", () => {
			const price = getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 3 },
				{ rarity: MaterialRarity.RARE, quantity: 2 }
			]);
			expect(Number.isInteger(price)).toBe(true);
		});
	});

	describe("getDisenchantPrice", () => {
		it("should return 0 for BASIC rarity", () => {
			expect(getDisenchantPrice(ItemRarity.BASIC)).toBe(0);
		});

		it("should increase price with higher rarity", () => {
			const rarities = Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[];
			for (let i = 1; i < rarities.length; i++) {
				const lowerPrice = getDisenchantPrice(rarities[i - 1]);
				const higherPrice = getDisenchantPrice(rarities[i]);
				expect(higherPrice).toBeGreaterThanOrEqual(lowerPrice);
			}
		});

		it("should return a defined number for every item rarity", () => {
			const rarities = Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[];
			for (const rarity of rarities) {
				const price = getDisenchantPrice(rarity);
				expect(price).toBeDefined();
				expect(typeof price).toBe("number");
			}
		});
	});
});
