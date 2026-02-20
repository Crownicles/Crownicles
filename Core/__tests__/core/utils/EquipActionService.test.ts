import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";

// Mock storage
let mockSlots: {
	playerId: number;
	slot: number;
	itemCategory: number;
	itemId: number;
	itemLevel: number;
	itemEnchantmentId: string | null;
	isEquipped: () => boolean;
	save: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
}[] = [];

let mockInventoryInfo = {
	slotLimitForCategory: vi.fn().mockReturnValue(2)
};

let mockHome: { getLevel: () => { features: { inventoryBonus: { weapon: number; armor: number; potion: number; object: number } } } } | null = null;

const createMockInventorySlot = (
	playerId: number,
	slot: number,
	itemCategory: number,
	itemId: number,
	itemLevel = 1,
	itemEnchantmentId: string | null = null
) => ({
	playerId,
	slot,
	itemCategory,
	itemId,
	itemLevel,
	itemEnchantmentId,
	isEquipped: () => slot === 0,
	save: vi.fn().mockResolvedValue(undefined),
	destroy: vi.fn().mockImplementation(async function(this: typeof mockSlots[0]) {
		mockSlots = mockSlots.filter(s => s !== this);
	})
});

// Mock Player
vi.mock("../../../src/core/database/game/models/Player", () => ({
	Player: class {},
	Players: {
		getByKeycloakId: vi.fn().mockImplementation((keycloakId: string) =>
			keycloakId === "valid-player"
				? Promise.resolve({
					id: 1,
					keycloakId: "valid-player"
				})
				: Promise.resolve(null)
		)
	}
}));

// Mock InventorySlot
vi.mock("../../../src/core/database/game/models/InventorySlot", () => ({
	InventorySlot: {
		create: vi.fn().mockImplementation((data: {
			playerId: number;
			slot: number;
			itemCategory: number;
			itemId: number;
			itemLevel: number;
			itemEnchantmentId: string | null;
		}) => {
			const newSlot = createMockInventorySlot(
				data.playerId,
				data.slot,
				data.itemCategory,
				data.itemId,
				data.itemLevel,
				data.itemEnchantmentId
			);
			mockSlots.push(newSlot);
			return Promise.resolve(newSlot);
		})
	},
	InventorySlots: {
		getOfPlayer: vi.fn().mockImplementation(() => Promise.resolve(mockSlots))
	}
}));

// Mock InventoryInfo
vi.mock("../../../src/core/database/game/models/InventoryInfo", () => ({
	InventoryInfo: class {},
	InventoryInfos: {
		getOfPlayer: vi.fn().mockImplementation(() => Promise.resolve(mockInventoryInfo))
	}
}));

// Mock Home
vi.mock("../../../src/core/database/game/models/Home", () => ({
	Home: class {},
	Homes: {
		getOfPlayer: vi.fn().mockImplementation(() => Promise.resolve(mockHome))
	}
}));

// Mock buildEquipCategoryData
vi.mock("../../../src/commands/player/EquipCommand", () => ({
	buildEquipCategoryData: vi.fn().mockReturnValue([])
}));

// Import after mocking
import { handleEquipAction } from "../../../src/core/utils/EquipActionService";
import { CommandEquipActionReq } from "../../../../Lib/src/packets/commands/CommandEquipPacket";

describe("EquipActionService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSlots = [];
		mockInventoryInfo = {
			slotLimitForCategory: vi.fn().mockReturnValue(2)
		};
		mockHome = null;
	});

	describe("handleEquipAction - invalid player", () => {
		it("should return error for invalid player", async () => {
			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.EQUIP,
				itemCategory: ItemCategory.WEAPON,
				slot: 1
			} as CommandEquipActionReq;

			const result = await handleEquipAction("invalid-player", packet);

			expect(result.success).toBe(false);
			expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.INVALID);
		});
	});

	describe("handleEquipAction - equip action", () => {
		beforeEach(() => {
			// Setup: active slot (equipped, slot 0) + reserve slot (slot 1)
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null), // Equipped
				createMockInventorySlot(1, 1, ItemCategory.WEAPON, 200, 2, null)  // Reserve
			];
		});

		it("should swap items between active and reserve slots", async () => {
			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.EQUIP,
				itemCategory: ItemCategory.WEAPON,
				slot: 1
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(true);
			// After swap: active should have id 200, reserve should have id 100
			const activeSlot = mockSlots.find(s => s.slot === 0 && s.itemCategory === ItemCategory.WEAPON);
			const reserveSlot = mockSlots.find(s => s.slot === 1 && s.itemCategory === ItemCategory.WEAPON);

			expect(activeSlot?.itemId).toBe(200);
			expect(reserveSlot?.itemId).toBe(100);
		});

		it("should fail for non-existent reserve slot", async () => {
			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.EQUIP,
				itemCategory: ItemCategory.WEAPON,
				slot: 99 // Doesn't exist
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(false);
			expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.INVALID);
		});

		it("should move reserve item to empty active slot and destroy reserve", async () => {
			// Setup: empty active slot + reserve slot
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 0, 0, null), // Empty equipped
				createMockInventorySlot(1, 1, ItemCategory.WEAPON, 200, 2, null) // Reserve
			];

			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.EQUIP,
				itemCategory: ItemCategory.WEAPON,
				slot: 1
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(true);
			// Active slot should have the item, reserve should be destroyed
			const activeSlot = mockSlots.find(s => s.slot === 0 && s.itemCategory === ItemCategory.WEAPON);
			expect(activeSlot?.itemId).toBe(200);
			expect(mockSlots.filter(s => s.slot === 1).length).toBe(0);
		});
	});

	describe("handleEquipAction - deposit action", () => {
		beforeEach(() => {
			// Setup: equipped item in active slot
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null)
			];
		});

		it("should create new reserve slot when depositing", async () => {
			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(true);
			// Active slot should be empty
			const activeSlot = mockSlots.find(s => s.slot === 0 && s.itemCategory === ItemCategory.WEAPON);
			expect(activeSlot?.itemId).toBe(0);
			// New reserve slot should be created
			const reserveSlot = mockSlots.find(s => s.slot === 1 && s.itemCategory === ItemCategory.WEAPON);
			expect(reserveSlot?.itemId).toBe(100);
		});

		it("should fail when reserve is full", async () => {
			// Setup: active + max reserve slots filled
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null),
				createMockInventorySlot(1, 1, ItemCategory.WEAPON, 200, 1, null),
				createMockInventorySlot(1, 2, ItemCategory.WEAPON, 300, 1, null)
			];
			// slotLimitForCategory returns 2, so max reserve = 2 slots
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);

			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(false);
			expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.RESERVE_FULL);
		});

		it("should fail when active slot is empty", async () => {
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 0, 0, null) // Empty
			];

			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(false);
			expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.NO_ITEM);
		});

		it("should use empty reserve slot if one exists", async () => {
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null),
				createMockInventorySlot(1, 1, ItemCategory.WEAPON, 0, 0, null) // Empty reserve
			];

			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(true);
			// Item moved to existing empty reserve slot
			const reserveSlot = mockSlots.find(s => s.slot === 1 && s.itemCategory === ItemCategory.WEAPON);
			expect(reserveSlot?.itemId).toBe(100);
		});

		it("should account for home inventory bonus when checking capacity", async () => {
			// Setup: active + 1 reserve (at base backup limit of 1)
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null),
				createMockInventorySlot(1, 1, ItemCategory.WEAPON, 200, 1, null)
			];
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(2);

			// Without home bonus: backup capacity = 2-1 = 1, already 1 backup → reserveFull
			// With home bonus of 1: backup capacity = 3-1 = 2, only 1 backup → success
			mockHome = {
				getLevel: () => ({
					features: {
						inventoryBonus: {
							weapon: 1, armor: 0, potion: 0, object: 0
						}
					}
				})
			};

			const packet = {
				action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(true);
		});
	});

	describe("handleEquipAction - invalid action", () => {
		it("should return error for unknown action", async () => {
			mockSlots = [
				createMockInventorySlot(1, 0, ItemCategory.WEAPON, 100, 1, null)
			];

			const packet = {
				action: "invalid_action",
				itemCategory: ItemCategory.WEAPON,
				slot: 0
			} as unknown as CommandEquipActionReq;

			const result = await handleEquipAction("valid-player", packet);

			expect(result.success).toBe(false);
			expect(result.error).toBe(ItemConstants.EQUIP_ERRORS.INVALID);
		});
	});
});
