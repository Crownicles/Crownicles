import {
	describe, expect, it
} from "vitest";
import {
	ItemCategory, itemCategoryToString
} from "../../src/constants/ItemConstants";

describe("itemCategoryToString", () => {
	it("names the translation key of each item category", () => {
		expect(itemCategoryToString(ItemCategory.WEAPON)).toBe("weapons");
		expect(itemCategoryToString(ItemCategory.ARMOR)).toBe("armors");
		expect(itemCategoryToString(ItemCategory.POTION)).toBe("potions");
		expect(itemCategoryToString(ItemCategory.OBJECT)).toBe("objects");
	});
});
