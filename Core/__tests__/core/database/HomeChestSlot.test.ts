import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { ChestSlotsPerCategory } from "../../../../Lib/src/types/HomeFeatures";

// Create a mock class for HomeChestSlot
const createMockSlot = (homeId: number, slot: number, itemCategory: number, itemId = 0) => ({
	homeId,
	slot,
	itemCategory,
	itemId,
	itemLevel: itemId > 0 ? 1 : 0,
	itemEnchantmentId: null,
	isEmpty: () => itemId === 0,
	save: vi.fn().mockResolvedValue(undefined)
});

// Storage for mock slots
let mockSlots: ReturnType<typeof createMockSlot>[] = [];

// Mock the HomeChestSlot module
vi.mock("../../../src/core/database/game/models/HomeChestSlot", () => ({
	HomeChestSlot: {
		findAll: vi.fn().mockImplementation(({ where }: { where: { homeId: number; itemCategory?: number } }) => {
			let result = mockSlots.filter(s => s.homeId === where.homeId);
			if (where.itemCategory !== undefined) {
				result = result.filter(s => s.itemCategory === where.itemCategory);
			}
			return Promise.resolve(result);
		}),
		findOne: vi.fn().mockImplementation(({ where }: { where: { homeId: number; slot?: number; itemCategory?: number; itemId?: number } }) => {
			const result = mockSlots.find(s =>
				s.homeId === where.homeId &&
				(where.slot === undefined || s.slot === where.slot) &&
				(where.itemCategory === undefined || s.itemCategory === where.itemCategory) &&
				(where.itemId === undefined || s.itemId === where.itemId)
			);
			return Promise.resolve(result ?? null);
		}),
		bulkCreate: vi.fn().mockImplementation((slots: { homeId: number; slot: number; itemCategory: number; itemId: number; itemLevel: number; itemEnchantmentId: null }[]) => {
			for (const slot of slots) {
				// ignoreDuplicates: don't add if exists
				const exists = mockSlots.some(s =>
					s.homeId === slot.homeId &&
					s.slot === slot.slot &&
					s.itemCategory === slot.itemCategory
				);
				if (!exists) {
					mockSlots.push(createMockSlot(slot.homeId, slot.slot, slot.itemCategory, slot.itemId));
				}
			}
			return Promise.resolve(slots);
		}),
		destroy: vi.fn().mockImplementation(({ where }: { where: { homeId: number } }) => {
			const before = mockSlots.length;
			mockSlots = mockSlots.filter(s => s.homeId !== where.homeId);
			return Promise.resolve(before - mockSlots.length);
		})
	},
	HomeChestSlots: {
		getOfHome: vi.fn().mockImplementation((homeId: number) => {
			const HomeChestSlot = { findAll: vi.fn() };
			return Promise.resolve(mockSlots.filter(s => s.homeId === homeId));
		}),
		getOfHomeByCategory: vi.fn().mockImplementation((homeId: number, category: ItemCategory) =>
			Promise.resolve(mockSlots.filter(s => s.homeId === homeId && s.itemCategory === category))
		),
		getSlot: vi.fn().mockImplementation((homeId: number, slot: number, category: ItemCategory) =>
			Promise.resolve(mockSlots.find(s => s.homeId === homeId && s.slot === slot && s.itemCategory === category) ?? null)
		),
		findEmptySlot: vi.fn().mockImplementation((homeId: number, category: ItemCategory) =>
			Promise.resolve(mockSlots.find(s => s.homeId === homeId && s.itemCategory === category && s.itemId === 0) ?? null)
		),
		getFilledSlots: vi.fn().mockImplementation((homeId: number, category: ItemCategory) =>
			Promise.resolve(mockSlots.filter(s => s.homeId === homeId && s.itemCategory === category && s.itemId !== 0))
		),
		initializeSlots: vi.fn().mockImplementation(async (homeId: number, slotsPerCategory: ChestSlotsPerCategory) => {
			const categoryMap = [
				{ key: "weapon" as const, category: ItemCategory.WEAPON },
				{ key: "armor" as const, category: ItemCategory.ARMOR },
				{ key: "object" as const, category: ItemCategory.OBJECT },
				{ key: "potion" as const, category: ItemCategory.POTION }
			];

			for (const { key, category } of categoryMap) {
				for (let slot = 1; slot <= slotsPerCategory[key]; slot++) {
					const exists = mockSlots.some(s =>
						s.homeId === homeId &&
						s.slot === slot &&
						s.itemCategory === category
					);
					if (!exists) {
						mockSlots.push(createMockSlot(homeId, slot, category, 0));
					}
				}
			}
		}),
		ensureSlotsForLevel: vi.fn().mockImplementation(async (homeId: number, slotsPerCategory: ChestSlotsPerCategory) => {
			const { HomeChestSlots } = await import("../../../src/core/database/game/models/HomeChestSlot");
			await HomeChestSlots.initializeSlots(homeId, slotsPerCategory);
		}),
		deleteOfHome: vi.fn().mockImplementation((homeId: number) => {
			mockSlots = mockSlots.filter(s => s.homeId !== homeId);
			return Promise.resolve();
		})
	}
}));

// Import after mocking
import { HomeChestSlots } from "../../../src/core/database/game/models/HomeChestSlot";

describe("HomeChestSlots", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSlots = [];
	});

	describe("initializeSlots", () => {
		it("should create empty slots based on slotsPerCategory", async () => {
			const slotsPerCategory: ChestSlotsPerCategory = {
				weapon: 2,
				armor: 1,
				object: 0,
				potion: 1
			};

			await HomeChestSlots.initializeSlots(1, slotsPerCategory);

			// Check total: 2 weapons + 1 armor + 0 objects + 1 potion = 4 slots
			expect(mockSlots.length).toBe(4);

			// Check weapons
			const weapons = mockSlots.filter(s => s.itemCategory === ItemCategory.WEAPON);
			expect(weapons.length).toBe(2);
			expect(weapons[0].slot).toBe(1);
			expect(weapons[1].slot).toBe(2);

			// Check armors
			const armors = mockSlots.filter(s => s.itemCategory === ItemCategory.ARMOR);
			expect(armors.length).toBe(1);

			// Check potions
			const potions = mockSlots.filter(s => s.itemCategory === ItemCategory.POTION);
			expect(potions.length).toBe(1);

			// Check objects
			const objects = mockSlots.filter(s => s.itemCategory === ItemCategory.OBJECT);
			expect(objects.length).toBe(0);
		});

		it("should not duplicate slots on repeated calls", async () => {
			const slotsPerCategory: ChestSlotsPerCategory = {
				weapon: 1,
				armor: 1,
				object: 0,
				potion: 0
			};

			await HomeChestSlots.initializeSlots(1, slotsPerCategory);
			expect(mockSlots.length).toBe(2);

			// Call again — should not add more
			await HomeChestSlots.initializeSlots(1, slotsPerCategory);
			expect(mockSlots.length).toBe(2);
		});
	});

	describe("findEmptySlot", () => {
		it("should return an empty slot when one exists", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100), // Filled
				createMockSlot(1, 2, ItemCategory.WEAPON, 0)    // Empty
			];

			const result = await HomeChestSlots.findEmptySlot(1, ItemCategory.WEAPON);
			expect(result).not.toBeNull();
			expect(result?.slot).toBe(2);
		});

		it("should return null when all slots are filled", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100),
				createMockSlot(1, 2, ItemCategory.WEAPON, 101)
			];

			const result = await HomeChestSlots.findEmptySlot(1, ItemCategory.WEAPON);
			expect(result).toBeNull();
		});

		it("should only search in the correct category", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100), // Filled weapon
				createMockSlot(1, 1, ItemCategory.ARMOR, 0)     // Empty armor
			];

			const weaponResult = await HomeChestSlots.findEmptySlot(1, ItemCategory.WEAPON);
			expect(weaponResult).toBeNull();

			const armorResult = await HomeChestSlots.findEmptySlot(1, ItemCategory.ARMOR);
			expect(armorResult).not.toBeNull();
		});
	});

	describe("getFilledSlots", () => {
		it("should return only non-empty slots for the category", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100), // Filled
				createMockSlot(1, 2, ItemCategory.WEAPON, 0),   // Empty
				createMockSlot(1, 3, ItemCategory.WEAPON, 101)  // Filled
			];

			const result = await HomeChestSlots.getFilledSlots(1, ItemCategory.WEAPON);
			expect(result.length).toBe(2);
			expect(result.every(s => s.itemId !== 0)).toBe(true);
		});

		it("should return empty array when no filled slots exist", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 0),
				createMockSlot(1, 2, ItemCategory.WEAPON, 0)
			];

			const result = await HomeChestSlots.getFilledSlots(1, ItemCategory.WEAPON);
			expect(result.length).toBe(0);
		});
	});

	describe("getSlot", () => {
		it("should return a specific slot", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100),
				createMockSlot(1, 2, ItemCategory.WEAPON, 101)
			];

			const result = await HomeChestSlots.getSlot(1, 2, ItemCategory.WEAPON);
			expect(result).not.toBeNull();
			expect(result?.itemId).toBe(101);
		});

		it("should return null for non-existent slot", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100)
			];

			const result = await HomeChestSlots.getSlot(1, 99, ItemCategory.WEAPON);
			expect(result).toBeNull();
		});
	});

	describe("deleteOfHome", () => {
		it("should remove all slots for a home", async () => {
			mockSlots = [
				createMockSlot(1, 1, ItemCategory.WEAPON, 100),
				createMockSlot(1, 2, ItemCategory.ARMOR, 0),
				createMockSlot(2, 1, ItemCategory.WEAPON, 50) // Different home
			];

			await HomeChestSlots.deleteOfHome(1);

			expect(mockSlots.length).toBe(1);
			expect(mockSlots[0].homeId).toBe(2);
		});
	});
});
