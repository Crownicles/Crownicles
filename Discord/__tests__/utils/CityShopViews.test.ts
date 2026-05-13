import {
	describe, expect, it
} from "vitest";
import {
	buildShopAmountCustomId,
	CITY_SHOP_CUSTOM_IDS,
	groupReactionsByItem,
	parseShopAmountCustomId
} from "../../src/utils/cityShop/CityShopViews";
import { ShopItemType } from "../../../Lib/src/constants/LogsConstants";
import { ReactionCollectorShopItemReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";

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
