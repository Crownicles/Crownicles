import {
	describe, expect, it, vi
} from "vitest";

/*
 * Keep i18n + DisplayUtils stubbed so the tests focus on the dispatch logic
 * (registry lookup, isSingleUnit, baseUnitPrice) without pulling the full
 * Discord rendering stack.
 */
vi.mock("../../src/translations/i18n", () => ({
	default: {
		t: (key: string, opts?: { plantId?: number }) =>
			(opts?.plantId !== undefined ? `${key}:${opts.plantId}` : key)
	}
}));
vi.mock("../../src/utils/DisplayUtils", () => ({
	DisplayUtils: {
		getItemDisplayWithStats: () => "DAILY_FULL",
		getSimpleItemDisplay: () => "DAILY_SHORT"
	}
}));

import {
	buildItemDisplay,
	buildShopAmountCustomId,
	CITY_SHOP_CUSTOM_IDS,
	groupReactionsByItem,
	parseShopAmountCustomId
} from "../../src/utils/cityShop/CityShopViews";
import { ShopItemType } from "../../../Lib/src/constants/LogsConstants";
import { ReactionCollectorShopItemReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ShopCurrency } from "../../../Lib/src/constants/ShopConstants";

function buildItemReaction(shopItemId: ShopItemType, amount: number, price: number): {
	type: string; data: ReactionCollectorShopItemReaction;
} {
	return {
		type: ReactionCollectorShopItemReaction.name,
		data: {
			shopCategoryId: "cat",
			shopItemId,
			price,
			amount
		}
	};
}

describe("buildShopAmountCustomId / parseShopAmountCustomId", () => {
	it("round-trips a simple item id and amount", () => {
		const customId = buildShopAmountCustomId("dailyPotion", 1);
		expect(customId.startsWith(CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX)).toBe(true);
		expect(parseShopAmountCustomId(customId)).toEqual({
			itemIdStr: "dailyPotion",
			amount: 1
		});
	});

	it("round-trips multi-digit amounts", () => {
		const customId = buildShopAmountCustomId("woodCommonBundle", 1234);
		expect(parseShopAmountCustomId(customId)).toEqual({
			itemIdStr: "woodCommonBundle",
			amount: 1234
		});
	});

	it("handles item ids containing underscores", () => {
		// Underscore in itemIdStr would have broken the previous lastIndexOf-based parser.
		const customId = buildShopAmountCustomId("future_item_with_underscores", 7);
		expect(parseShopAmountCustomId(customId)).toEqual({
			itemIdStr: "future_item_with_underscores",
			amount: 7
		});
	});

	it("returns null when the prefix is missing", () => {
		expect(parseShopAmountCustomId("notTheRightPrefix|5")).toBeNull();
	});

	it("returns null when the separator is missing", () => {
		expect(parseShopAmountCustomId(`${CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX}noSeparatorHere`)).toBeNull();
	});

	it("returns null when the amount is not numeric", () => {
		expect(parseShopAmountCustomId(`${CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX}item|notANumber`)).toBeNull();
	});
});

describe("groupReactionsByItem", () => {
	it("groups multiple reactions sharing the same shopItemId", () => {
		const packet = {
			reactions: [
				buildItemReaction(ShopItemType.DAILY_POTION, 1, 100),
				buildItemReaction(ShopItemType.DAILY_POTION, 5, 450),
				buildItemReaction(ShopItemType.RANDOM_ITEM, 1, 200)
			]
		} as unknown as ReactionCollectorCreationPacket;

		const grouped = groupReactionsByItem(packet);

		expect(grouped.size).toBe(2);
		expect(grouped.get(ShopItemType.DAILY_POTION)).toHaveLength(2);
		expect(grouped.get(ShopItemType.RANDOM_ITEM)).toHaveLength(1);
		expect(grouped.get(ShopItemType.DAILY_POTION)!.map(r => r.amount)).toEqual([1, 5]);
	});

	it("ignores reactions whose type is not ReactionCollectorShopItemReaction", () => {
		const packet = {
			reactions: [
				buildItemReaction(ShopItemType.DAILY_POTION, 1, 100),
				{
					type: "SomethingElse", data: {}
				}
			]
		} as unknown as ReactionCollectorCreationPacket;

		const grouped = groupReactionsByItem(packet);

		expect(grouped.size).toBe(1);
		expect(grouped.get(ShopItemType.DAILY_POTION)).toHaveLength(1);
	});

	it("returns an empty map when no shop item reactions are present", () => {
		const packet = { reactions: [] } as unknown as ReactionCollectorCreationPacket;
		expect(groupReactionsByItem(packet).size).toBe(0);
	});
});

describe("buildItemDisplay", () => {
	const baseData = {
		availableCurrency: 0,
		currency: ShopCurrency.MONEY,
		additionalShopData: {}
	} as unknown as Parameters<typeof buildItemDisplay>[0];

	function reactionsFor(shopItemId: ShopItemType, amounts: Array<{ amount: number; price: number }>): ReactionCollectorShopItemReaction[] {
		return amounts.map(({ amount, price }) => ({
			shopCategoryId: "cat",
			shopItemId,
			amount,
			price
		}));
	}

	it("flags single-unit items and uses the unique reaction price as base unit price", () => {
		const display = buildItemDisplay(
			baseData,
			reactionsFor(ShopItemType.RANDOM_ITEM, [{
				amount: 1, price: 200
			}]),
			"en"
		);
		expect(display.isSingleUnit).toBe(true);
		expect(display.amounts).toEqual([1]);
		expect(display.baseUnitPrice).toBe(200);
	});

	it("derives base unit price from the smallest-amount reaction for multi-bundle items", () => {
		// 1@100 + 10@500 → smallest bundle drives baseUnitPrice = 100 (not the bulk-discount 50).
		const display = buildItemDisplay(
			baseData,
			reactionsFor(ShopItemType.RANDOM_ITEM, [
				{
					amount: 10, price: 500
				},
				{
					amount: 1, price: 100
				}
			]),
			"en"
		);
		expect(display.isSingleUnit).toBe(false);
		expect(display.amounts).toEqual([10, 1]);
		expect(display.baseUnitPrice).toBe(100);
	});

	it("uses the DAILY_POTION resolver (DisplayUtils stats) when available", () => {
		const dataWithPotion = {
			...baseData,
			additionalShopData: {
				dailyPotion: {
					id: 42, itemCategory: 1
				}
			}
		} as unknown as Parameters<typeof buildItemDisplay>[0];
		const display = buildItemDisplay(
			dataWithPotion,
			reactionsFor(ShopItemType.DAILY_POTION, [{
				amount: 1, price: 300
			}]),
			"en"
		);
		expect(display.fullName).toBe("DAILY_FULL");
		expect(display.shortLabel).toBe("DAILY_SHORT");
	});

	it("resolves each weekly plant tier with its own plantId from additionalShopData", () => {
		const dataWithPlants = {
			...baseData,
			additionalShopData: {
				weeklyPlants: [10, 20, 30]
			}
		} as unknown as Parameters<typeof buildItemDisplay>[0];

		const tier1 = buildItemDisplay(dataWithPlants, reactionsFor(ShopItemType.WEEKLY_PLANT_TIER_1, [{
			amount: 1, price: 1
		}]), "en");
		const tier2 = buildItemDisplay(dataWithPlants, reactionsFor(ShopItemType.WEEKLY_PLANT_TIER_2, [{
			amount: 1, price: 1
		}]), "en");
		const tier3 = buildItemDisplay(dataWithPlants, reactionsFor(ShopItemType.WEEKLY_PLANT_TIER_3, [{
			amount: 1, price: 1
		}]), "en");

		// Mocked i18n echoes the key + plantId — verifies the right plant index is forwarded per tier.
		expect(tier1.shortLabel).toContain(":10");
		expect(tier2.shortLabel).toContain(":20");
		expect(tier3.shortLabel).toContain(":30");
	});

	it("falls back to the generic i18n-based label for unregistered item types", () => {
		const display = buildItemDisplay(
			baseData,
			reactionsFor(ShopItemType.RANDOM_ITEM, [{
				amount: 1, price: 50
			}]),
			"en"
		);
		// Generic resolver wraps the short label in bold for fullName.
		expect(display.fullName).toBe(`**${display.shortLabel}**`);
		// And the short label is the raw i18n key (since mocked t() returns the key).
		expect(display.shortLabel).toContain("shop.shopItems.");
	});
});
