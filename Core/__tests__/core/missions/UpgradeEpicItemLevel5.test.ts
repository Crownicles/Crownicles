import {
	describe, it, expect, vi, beforeEach
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/upgradeEpicItemLevel5";
import {
	ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeChestSlots } from "../../../src/core/database/game/models/HomeChestSlot";

const player = { id: 1 } as never;

function inventorySlot(options: { primary: boolean; rarity: number; level: number }): never {
	return {
		isPrimaryEquipment: (): boolean => options.primary,
		getItem: (): { rarity: number } => ({ rarity: options.rarity }),
		itemLevel: options.level
	} as never;
}

function chestSlot(options: { empty: boolean; category: ItemCategory; rarity: number; level: number }): never {
	return {
		isEmpty: (): boolean => options.empty,
		itemCategory: options.category,
		getItem: (): { rarity: number } => ({ rarity: options.rarity }),
		itemLevel: options.level
	} as never;
}

describe("upgradeEpicItemLevel5 mission", () => {
	describe("initialNumberDone", () => {
		beforeEach(() => {
			vi.restoreAllMocks();
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([]);
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([]);
		});

		it("should validate when a qualifying item is equipped or in the inventory reserve", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: true, rarity: ItemConstants.RARITY.EPIC, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should not validate an inventory item below the required level", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: true, rarity: ItemConstants.RARITY.EPIC, level: 4 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should not validate an inventory item below epic rarity", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: true, rarity: ItemConstants.RARITY.EPIC - 1, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should ignore a qualifying item in a non-primary slot", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: false, rarity: ItemConstants.RARITY.EPIC, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should validate when a qualifying item is stored in the home chest", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([
				chestSlot({ empty: false, category: ItemCategory.WEAPON, rarity: ItemConstants.RARITY.EPIC, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should ignore an empty home chest slot", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([
				chestSlot({ empty: true, category: ItemCategory.WEAPON, rarity: ItemConstants.RARITY.EPIC, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should ignore a non weapon/armor chest item", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([
				chestSlot({ empty: false, category: ItemCategory.POTION, rarity: ItemConstants.RARITY.EPIC, level: 5 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should not validate when the player owns nothing qualifying", async () => {
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});
	});

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
