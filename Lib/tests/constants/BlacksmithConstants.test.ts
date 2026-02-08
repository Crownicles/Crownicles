import { describe, expect, it } from "vitest";
import { BlacksmithConstants } from "../../src/constants/BlacksmithConstants";
import { ItemRarity } from "../../src/constants/ItemConstants";
import { MaterialRarity } from "../../src/types/MaterialRarity";

describe("BlacksmithConstants", () => {
	describe("getUpgradePrice", () => {
		it("should return the base price for EPIC rarity (reference rarity)", () => {
			expect(BlacksmithConstants.getUpgradePrice(1, ItemRarity.EPIC)).toBe(50);
			expect(BlacksmithConstants.getUpgradePrice(2, ItemRarity.EPIC)).toBe(500);
			expect(BlacksmithConstants.getUpgradePrice(3, ItemRarity.EPIC)).toBe(1500);
			expect(BlacksmithConstants.getUpgradePrice(4, ItemRarity.EPIC)).toBe(3500);
		});

		it("should increase price for rarities above EPIC", () => {
			const epicPrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.EPIC);
			const legendaryPrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.LEGENDARY);
			const mythicalPrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.MYTHICAL);

			expect(legendaryPrice).toBeGreaterThan(epicPrice);
			expect(mythicalPrice).toBeGreaterThan(legendaryPrice);
		});

		it("should decrease price for rarities below EPIC", () => {
			const epicPrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.EPIC);
			const rarePrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.RARE);
			const commonPrice = BlacksmithConstants.getUpgradePrice(1, ItemRarity.COMMON);

			expect(rarePrice).toBeLessThan(epicPrice);
			expect(commonPrice).toBeLessThan(rarePrice);
		});

		it("should always return a positive price", () => {
			for (const level of [1, 2, 3, 4] as const) {
				for (const rarity of Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[]) {
					const price = BlacksmithConstants.getUpgradePrice(level, rarity);
					expect(price).toBeGreaterThan(0);
				}
			}
		});

		it("should return integer values", () => {
			for (const level of [1, 2, 3, 4] as const) {
				for (const rarity of Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[]) {
					const price = BlacksmithConstants.getUpgradePrice(level, rarity);
					expect(Number.isInteger(price)).toBe(true);
				}
			}
		});

		it("should increase price with higher target levels", () => {
			const rarity = ItemRarity.EPIC;
			const price1 = BlacksmithConstants.getUpgradePrice(1, rarity);
			const price2 = BlacksmithConstants.getUpgradePrice(2, rarity);
			const price3 = BlacksmithConstants.getUpgradePrice(3, rarity);
			const price4 = BlacksmithConstants.getUpgradePrice(4, rarity);

			expect(price2).toBeGreaterThan(price1);
			expect(price3).toBeGreaterThan(price2);
			expect(price4).toBeGreaterThan(price3);
		});
	});

	describe("getMaterialsPurchasePrice", () => {
		it("should return 0 for empty materials array", () => {
			expect(BlacksmithConstants.getMaterialsPurchasePrice([])).toBe(0);
		});

		it("should return base price for a single material of quantity 1", () => {
			const price = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			expect(price).toBe(BlacksmithConstants.MATERIAL_BASE_PRICE[MaterialRarity.COMMON]);
		});

		it("should increase price for multiple materials (bulk pricing)", () => {
			const singlePrice = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			const doublePrice = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 2 }
			]);

			// Second material should cost more than the first
			expect(doublePrice).toBeGreaterThan(singlePrice * 2 - 1);
		});

		it("should apply increasing bulk pricing across different rarities", () => {
			const price = BlacksmithConstants.getMaterialsPurchasePrice([
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
			const commonPrice = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 1 }
			]);
			const uncommonPrice = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.UNCOMMON, quantity: 1 }
			]);
			const rarePrice = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.RARE, quantity: 1 }
			]);

			expect(uncommonPrice).toBeGreaterThan(commonPrice);
			expect(rarePrice).toBeGreaterThan(uncommonPrice);
		});

		it("should return integer values", () => {
			const price = BlacksmithConstants.getMaterialsPurchasePrice([
				{ rarity: MaterialRarity.COMMON, quantity: 3 },
				{ rarity: MaterialRarity.RARE, quantity: 2 }
			]);
			expect(Number.isInteger(price)).toBe(true);
		});
	});

	describe("getDisenchantPrice", () => {
		it("should return 0 for BASIC rarity", () => {
			expect(BlacksmithConstants.getDisenchantPrice(ItemRarity.BASIC)).toBe(0);
		});

		it("should return the correct price from the DISENCHANT_PRICE table", () => {
			expect(BlacksmithConstants.getDisenchantPrice(ItemRarity.COMMON)).toBe(50);
			expect(BlacksmithConstants.getDisenchantPrice(ItemRarity.EPIC)).toBe(1500);
			expect(BlacksmithConstants.getDisenchantPrice(ItemRarity.MYTHICAL)).toBe(6000);
		});

		it("should increase price with higher rarity", () => {
			const rarities = Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[];
			for (let i = 1; i < rarities.length; i++) {
				const lowerPrice = BlacksmithConstants.getDisenchantPrice(rarities[i - 1]);
				const higherPrice = BlacksmithConstants.getDisenchantPrice(rarities[i]);
				expect(higherPrice).toBeGreaterThanOrEqual(lowerPrice);
			}
		});

		it("should have a defined price for every item rarity", () => {
			const rarities = Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[];
			for (const rarity of rarities) {
				const price = BlacksmithConstants.getDisenchantPrice(rarity);
				expect(price).toBeDefined();
				expect(typeof price).toBe("number");
			}
		});
	});
});
