import { beforeEach, describe, expect, it, vi } from "vitest";
import SellCommand from "../../../../src/commands/player/SellCommand";
import { InventorySlot, InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { BlockingUtils } from "../../../../src/core/utils/BlockingUtils";
import {
	countNbOfPotions, getItemByIdAndCategory, getItemValue, sortPlayerItemList
} from "../../../../src/core/utils/ItemUtils";
import { crowniclesInstance } from "../../../../src";
import { ItemCategory } from "../../../../../Lib/src/constants/ItemConstants";
import { BlessingManager } from "../../../../src/core/blessings/BlessingManager";

let capturedCollectorCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: {
			NOT_STARTED_OR_DEAD_OR_JAILED: []
		}
	}
}));

vi.mock("../../../../src/core/database/game/models/InventorySlot");
vi.mock("../../../../src/core/missions/MissionsController");
vi.mock("../../../../src/core/utils/BlockingUtils");
vi.mock("../../../../src/core/utils/ItemUtils");
vi.mock("../../../../src", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logItemSell: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../../src/core/blessings/BlessingManager", () => ({
	BlessingManager: {
		getInstance: vi.fn(() => ({
			applyMoneyBlessing: vi.fn((value: number) => value)
		}))
	}
}));
vi.mock("../../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, callback: typeof capturedCollectorCallback) {
			capturedCollectorCallback = callback;
		}

		block() {
			return this;
		}

		build() {
			return this;
		}
	}
}));
vi.mock("../../../../../Lib/src/packets/CrowniclesPacket", () => ({
	CrowniclesPacket: class {},
	PacketContext: class {},
	PacketDirection: {
		NONE: 0,
		FRONT_TO_BACK: 1,
		BACK_TO_FRONT: 2
	},
	sendablePacket: vi.fn(() => () => {}),
	makePacket: vi.fn((PacketType, data) => ({
		type: PacketType.name,
		data
	}))
}));

describe("SellCommand", () => {
	const player = {
		id: 42,
		keycloakId: "player-keycloak-id",
		reload: vi.fn(),
		addMoney: vi.fn(),
		save: vi.fn()
	};
	const context = {
		discord: {
			interaction: "interaction-id"
		}
	};

	beforeEach(() => {
		capturedCollectorCallback = undefined;
		vi.clearAllMocks();

		vi.mocked(sortPlayerItemList).mockImplementation(slots => slots);
		vi.mocked(getItemValue).mockReturnValue(42);
		vi.mocked(getItemByIdAndCategory).mockReturnValue({ id: 123 });
		vi.mocked(countNbOfPotions).mockReturnValue(0);
		vi.mocked(InventorySlot.destroy).mockResolvedValue(1);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
		vi.mocked(MissionsController.update).mockResolvedValue(player as never);
		vi.mocked(BlockingUtils.unblockPlayer).mockResolvedValue();
		vi.mocked(crowniclesInstance.logsDatabase.logItemSell).mockResolvedValue(undefined);
		vi.mocked(BlessingManager.getInstance).mockReturnValue({
			applyMoneyBlessing: vi.fn((value: number) => value)
		} as never);
	});

	async function executeCommandWithSlot(slot: {
		slot: number;
		itemId: number;
		itemCategory: ItemCategory;
		isEquipped: () => boolean;
		getItem: () => unknown;
		isPotion?: () => boolean;
		playerId?: number;
	}): Promise<void> {
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([slot as never]);

		await new SellCommand().execute([], player as never, {} as never, context as never);
		await capturedCollectorCallback?.({
			getFirstReaction: () => ({
				reaction: {
					type: "ReactionCollectorSellItemReaction",
					data: {
						item: {
							id: slot.itemId,
							category: slot.itemCategory
						},
						slot: slot.slot,
						price: slot.itemCategory === ItemCategory.POTION ? 0 : 42
					}
				}
			})
		}, []);
	}

	it("does not update sell missions when a potion is thrown away", async () => {
		await executeCommandWithSlot({
			slot: 0,
			itemId: 123,
			itemCategory: ItemCategory.POTION,
			isEquipped: () => false,
			isPotion: () => true,
			getItem: () => ({ id: 123 })
		});

		expect(MissionsController.update).not.toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "sellItems"
		});
		expect(MissionsController.update).not.toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "sellItemWithGivenCost",
			params: { itemCost: 0 }
		});
		expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "havePotions",
			count: 0,
			set: true
		});
	});

	it("keeps updating sell missions for non-potion items", async () => {
		await executeCommandWithSlot({
			slot: 1,
			itemId: 456,
			itemCategory: ItemCategory.WEAPON,
			isEquipped: () => false,
			isPotion: () => false,
			getItem: () => ({ id: 456 })
		});

		expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "sellItemWithGivenCost",
			params: { itemCost: 42 }
		});
		expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), {
			missionId: "sellItems"
		});
	});
});