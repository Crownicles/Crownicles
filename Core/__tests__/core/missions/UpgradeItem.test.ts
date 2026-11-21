import {
	describe, it, expect, vi, beforeEach
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/upgradeItem";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeChestSlots } from "../../../src/core/database/game/models/HomeChestSlot";

const player = { id: 1 } as never;

function inventorySlot(options: { primary: boolean; level: number }): never {
	return {
		isPrimaryEquipment: (): boolean => options.primary,
		getItem: (): { rarity: number } => ({ rarity: 1 }),
		itemLevel: options.level
	} as never;
}

function chestSlot(options: { category: ItemCategory; level: number }): never {
	return {
		isEmpty: (): boolean => false,
		itemCategory: options.category,
		getItem: (): { rarity: number } => ({ rarity: 1 }),
		itemLevel: options.level
	} as never;
}

describe("upgradeItem mission", () => {
	describe("initialNumberDone (#5067)", () => {
		beforeEach(() => {
			vi.restoreAllMocks();
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([]);
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([]);
		});

		it("should validate when the player already owns an upgraded weapon or shield", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: true, level: 0 }),
				inventorySlot({ primary: true, level: 1 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should validate when an upgraded weapon or shield is stored in the home chest", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([
				chestSlot({ category: ItemCategory.ARMOR, level: 2 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should not validate when no weapon or shield has been upgraded", async () => {
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot({ primary: true, level: 0 }),
				inventorySlot({ primary: false, level: 3 })
			] as never);
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomeChestSlots, "getOfHome").mockResolvedValue([
				chestSlot({ category: ItemCategory.WEAPON, level: 0 })
			] as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});
	});
});
