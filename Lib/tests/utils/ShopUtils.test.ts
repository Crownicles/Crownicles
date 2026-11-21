import {
	describe, expect, it
} from "vitest";
import {
	ShopItemType, ShopItemTypeToString
} from "../../src/constants/LogsConstants";
import {
	shopItemTypeFromId, shopItemTypeToId
} from "../../src/utils/ShopUtils";

describe("ShopUtils", () => {
	it("gives each shop item type back from its id", () => {
		const types = Object.keys(ShopItemTypeToString).map(key => Number(key) as ShopItemType);

		for (const type of types) {
			expect(shopItemTypeFromId(shopItemTypeToId(type))).toBe(type);
		}
		expect(new Set(types.map(shopItemTypeToId)).size).toBe(types.length);
	});

	it("maps the ids sent by the front-end", () => {
		expect(shopItemTypeToId(ShopItemType.DAILY_POTION)).toBe("dailyPotion");
		expect(shopItemTypeFromId("tokenCharity")).toBe(ShopItemType.TOKEN_CHARITY);
	});
});
