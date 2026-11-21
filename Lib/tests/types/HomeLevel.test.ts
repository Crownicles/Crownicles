import {
	describe, expect, it
} from "vitest";
import { HomeLevel } from "../../src/types/HomeLevel";
import {
	ChestSlotsPerCategory, getSlotCountForCategory
} from "../../src/types/HomeFeatures";
import { ItemCategory } from "../../src/constants/ItemConstants";

describe("HomeLevel", () => {
	it("starts every player at the first level", () => {
		expect(HomeLevel.getInitialLevel()).toBe(HomeLevel.LEVEL_1);
	});

	it("finds a level by its number, and nothing outside the existing ones", () => {
		expect(HomeLevel.getByLevel(1)).toBe(HomeLevel.LEVEL_1);
		expect(HomeLevel.getByLevel(8)).toBe(HomeLevel.LEVEL_8);
		expect(HomeLevel.getByLevel(0)).toBeNull();
		expect(HomeLevel.getByLevel(9)).toBeNull();
	});

	it("numbers the levels in order", () => {
		for (let level = 1; level <= 8; level++) {
			expect(HomeLevel.getByLevel(level)?.level).toBe(level);
		}
	});

	it("offers the next level once the player reaches its required level", () => {
		const required = HomeLevel.LEVEL_3.requiredPlayerLevel;

		expect(HomeLevel.getNextUpgrade(HomeLevel.LEVEL_2, required - 1)).toBeNull();
		expect(HomeLevel.getNextUpgrade(HomeLevel.LEVEL_2, required)).toBe(HomeLevel.LEVEL_3);
	});

	it("offers no upgrade after the last level", () => {
		expect(HomeLevel.getNextUpgrade(HomeLevel.LEVEL_8, 1000)).toBeNull();
		expect(HomeLevel.getNextLevelInfo(HomeLevel.LEVEL_8)).toBeNull();
	});

	it("describes the next level whatever the player level", () => {
		expect(HomeLevel.getNextLevelInfo(HomeLevel.LEVEL_1)).toBe(HomeLevel.LEVEL_2);
		expect(HomeLevel.getNextLevelInfo(HomeLevel.LEVEL_7)).toBe(HomeLevel.LEVEL_8);
	});
});

describe("getSlotCountForCategory", () => {
	it("reads the slots of the given item category", () => {
		const slots: ChestSlotsPerCategory = {
			weapon: 1, armor: 2, object: 3, potion: 4
		};

		expect(getSlotCountForCategory(slots, ItemCategory.WEAPON)).toBe(1);
		expect(getSlotCountForCategory(slots, ItemCategory.ARMOR)).toBe(2);
		expect(getSlotCountForCategory(slots, ItemCategory.OBJECT)).toBe(3);
		expect(getSlotCountForCategory(slots, ItemCategory.POTION)).toBe(4);
	});
});
