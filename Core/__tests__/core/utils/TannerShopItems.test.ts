import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	getBuySlotExtensionShopItemCallback, getPlantSlotExtensionShopItem, getSlotExtensionShopItem
} from "../../../src/core/utils/TannerShopItems";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	InventoryInfo, InventoryInfos
} from "../../../src/core/database/game/models/InventoryInfo";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";
import { withLockedEntitiesSafe } from "../../../src/core/utils/withLockedEntitiesSafe";
import { crowniclesInstance } from "../../../src/app";
import {
	CommandShopClosed,
	CommandShopGenericPurchase,
	CommandShopNoPlantSlotAvailable,
	CommandShopNotEnoughCurrency,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ReactionCollectorBuyCategorySlotBuySuccess,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { PlantConstants } from "../../../../Lib/src/constants/PlantConstants";

type CollectorReaction = {
	reaction: {
		type: string; data: unknown;
	};
} | undefined;

type CapturedCollector = {
	packet: { reactions: { type: string; data: Record<string, number> }[] };
	options: { allowedPlayerKeycloakIds: string[] };
	block: [string, string];
};

let captured: Partial<CapturedCollector> = {};

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(collector: { creationPacket: (id: string, endTime: number) => CapturedCollector["packet"] }, _context: unknown, options: CapturedCollector["options"]) {
			captured.packet = collector.creationPacket("collector", 0);
			captured.options = options;
		}

		block(keycloakId: string, reason: string): this {
			captured.block = [keycloakId, reason];
			return this;
		}

		build(): this {
			return this;
		}
	}
}));
vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: { unblockPlayer: vi.fn() }
}));
vi.mock("../../../src/core/utils/withLockedEntitiesSafe", () => ({
	withLockedEntitiesSafe: vi.fn()
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logClassicalShopBuyout: vi.fn().mockResolvedValue(undefined) } }
}));

const context = {} as PacketContext;

type Slots = {
	weaponSlots: number; armorSlots: number; potionSlots: number; objectSlots: number; plantSlots: number;
};

/**
 * Inventory info of the player with the given slot counts, as loaded from the database
 */
function buildInventoryInfo(slots: Partial<Slots> = {}): InventoryInfo {
	return Object.assign(Object.create(InventoryInfo.prototype) as InventoryInfo, {
		playerId: 7,
		weaponSlots: 1,
		armorSlots: 1,
		potionSlots: 1,
		objectSlots: 1,
		plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS,
		save: vi.fn().mockResolvedValue(undefined),
		...slots
	});
}

/**
 * A player with the given money, as loaded from the database
 */
function buildPlayer(money: number, cityId: string | null = "city"): Player {
	return Object.assign(Object.create(Player.prototype) as Player, {
		id: 7,
		keycloakId: "kc",
		money,
		getCurrentCityId: (): string | null => cityId,
		spendMoney: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	});
}

describe("TannerShopItems", () => {
	let player: Player;
	let lockedPlayer: Player;
	let lockedInventoryInfo: InventoryInfo;

	/**
	 * Make the next critical section run against the given locked rows
	 */
	function lockRows(): void {
		vi.mocked(withLockedEntitiesSafe).mockImplementation(async (_keys, _context, body) => {
			await body([lockedPlayer, lockedInventoryInfo, {} as PlayerMissionsInfo] as never);
			return true;
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		captured = {};
		player = buildPlayer(10000);
		lockedPlayer = buildPlayer(10000);
		lockedInventoryInfo = buildInventoryInfo();
		vi.spyOn(Players, "getById").mockResolvedValue(player);
		vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({} as PlayerMissionsInfo);
		vi.spyOn(PlayerPlantSlots, "ensureSlotsForCount").mockResolvedValue(undefined);
		lockRows();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getSlotExtensionShopItem", () => {
		it("should not sell a slot when every category is full", async () => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({
				weaponSlots: 2, armorSlots: 2, potionSlots: 4, objectSlots: 4
			}));

			expect(await getSlotExtensionShopItem(7)).toBeNull();
		});

		it.each([
			[{}, 500],
			[{ armorSlots: 2 }, 1000],
			[{
				weaponSlots: 2, armorSlots: 2, potionSlots: 4, objectSlots: 3
			}, 30000]
		])("should price the next slot after the slots already bought (%o)", async (slots, price) => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo(slots));

			expect(await getSlotExtensionShopItem(7)).toMatchObject({
				id: ShopItemType.SLOT_EXTENSION, price, amounts: [1]
			});
		});

		it("should not sell a slot without a price for the number of slots already owned", async () => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({ weaponSlots: 10 }));

			expect(await getSlotExtensionShopItem(7)).toBeNull();
		});

		it("should let the player choose among the categories that can still grow", async () => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({
				weaponSlots: 2, potionSlots: 3
			}));
			const item = await getSlotExtensionShopItem(7) as ShopItem;
			const response: CrowniclesPacket[] = [];

			expect(item.buyCallback(response, 7, context, 1)).toBe(false);

			expect(response).toHaveLength(1);
			expect(captured.packet?.reactions
				.filter(reaction => reaction.type === ReactionCollectorBuyCategorySlotReaction.name)
				.map(reaction => [reaction.data.categoryId, reaction.data.remaining])).toEqual([
				[ItemCategory.ARMOR, 1],
				[ItemCategory.POTION, 1],
				[ItemCategory.OBJECT, 3]
			]);
			expect(captured.options).toEqual({ allowedPlayerKeycloakIds: ["kc"] });
			expect(captured.block).toEqual(["kc", BlockingConstants.REASONS.SLOT_EXTENSION]);
		});
	});

	describe("getBuySlotExtensionShopItemCallback", () => {
		/**
		 * End the category choice with the given reaction and return the packets pushed
		 */
		async function chooseCategory(reaction: CollectorReaction, price = 1000): Promise<CrowniclesPacket[]> {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo());
			const response: CrowniclesPacket[] = [];
			await getBuySlotExtensionShopItemCallback(7, price)({ getFirstReaction: () => reaction } as never, response);
			return response;
		}

		const armorReaction: CollectorReaction = {
			reaction: {
				type: ReactionCollectorBuyCategorySlotReaction.name, data: { categoryId: ItemCategory.ARMOR }
			}
		};

		it.each([
			["cancelled", {
				reaction: {
					type: ReactionCollectorBuyCategorySlotCancelReaction.name, data: {}
				}
			}],
			["ignored", undefined]
		])("should close the shop when the choice is %s", async (_name, reaction) => {
			const response = await chooseCategory(reaction);

			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("kc", BlockingConstants.REASONS.SLOT_EXTENSION);
			expect(response).toHaveLength(1);
			expect(response[0]).toBeInstanceOf(CommandShopClosed);
			expect(withLockedEntitiesSafe).not.toHaveBeenCalled();
		});

		it("should charge the slot and add it to the chosen category under lock", async () => {
			lockedPlayer.money = 1000;

			const response = await chooseCategory(armorReaction, 1000);

			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("kc", BlockingConstants.REASONS.SLOT_EXTENSION);
			expect(lockedPlayer.spendMoney).toHaveBeenCalledWith({
				amount: 1000, response, reason: NumberChangeReason.SHOP
			});
			expect(lockedInventoryInfo.armorSlots).toBe(2);
			expect(lockedInventoryInfo.weaponSlots).toBe(1);
			expect(lockedPlayer.save).toHaveBeenCalledOnce();
			expect(lockedInventoryInfo.save).toHaveBeenCalledOnce();
			expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout).toHaveBeenCalledWith("kc", ShopItemType.SLOT_EXTENSION, 1, "city");
			expect(response.at(-1)).toBeInstanceOf(ReactionCollectorBuyCategorySlotBuySuccess);
		});

		it("should log the purchase without city when the player is travelling", async () => {
			player = buildPlayer(10000, null);
			vi.mocked(Players.getById).mockResolvedValue(player);

			await chooseCategory(armorReaction);

			expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout).toHaveBeenCalledWith("kc", ShopItemType.SLOT_EXTENSION, 1, undefined);
		});

		it("should refuse the slot when the locked money no longer covers the price", async () => {
			lockedPlayer.money = 999;

			const response = await chooseCategory(armorReaction, 1000);

			expect(response).toHaveLength(1);
			expect(response[0]).toBeInstanceOf(CommandShopNotEnoughCurrency);
			expect(response[0]).toMatchObject({
				missingCurrency: 1, currency: ShopCurrency.MONEY
			});
			expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
			expect(lockedInventoryInfo.armorSlots).toBe(1);
			expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout).not.toHaveBeenCalled();
		});

		it("should not announce a purchase whose rows could not be locked", async () => {
			vi.mocked(withLockedEntitiesSafe).mockResolvedValue(false);

			const response = await chooseCategory(armorReaction);

			expect(response).toEqual([]);
			expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout).not.toHaveBeenCalled();
		});
	});

	describe("getPlantSlotExtensionShopItem", () => {
		it.each([
			[PlantConstants.MAX_PLANT_SLOTS],
			[PlantConstants.MAX_PLANT_SLOTS + 1],
			[PlantConstants.DEFAULT_PLANT_SLOTS - 1]
		])("should not sell a plant slot to a player having %s plant slots", async plantSlots => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({ plantSlots }));

			expect(await getPlantSlotExtensionShopItem(7)).toBeNull();
		});

		it.each([
			[1, 3000],
			[2, 8000]
		])("should price the plant slot after the %s owned plant slots", async (plantSlots, price) => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({ plantSlots }));

			expect(await getPlantSlotExtensionShopItem(7)).toMatchObject({
				id: ShopItemType.PLANT_SLOT_EXTENSION, price, amounts: [1]
			});
		});

		describe("buyCallback", () => {
			/**
			 * Buy the plant slot sold to a player owning one plant slot
			 */
			async function buyPlantSlot(): Promise<{
				result: unknown; response: CrowniclesPacket[];
			}> {
				vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue(buildInventoryInfo({ plantSlots: 1 }));
				const item = await getPlantSlotExtensionShopItem(7) as ShopItem;
				const response: CrowniclesPacket[] = [];
				const result = await item.buyCallback(response, 7, context, 1);
				return {
					result, response
				};
			}

			it("should charge, add and create the plant slot under lock, then announce it", async () => {
				lockedPlayer.money = 3000;
				lockedInventoryInfo.plantSlots = 1;

				const {
					result, response
				} = await buyPlantSlot();

				// The purchase is fully handled here, the shop must not charge it again
				expect(result).toEqual({ success: false });
				expect(lockedPlayer.spendMoney).toHaveBeenCalledWith({
					amount: 3000, response, reason: NumberChangeReason.SHOP
				});
				expect(lockedInventoryInfo.plantSlots).toBe(2);
				expect(lockedPlayer.save).toHaveBeenCalledOnce();
				expect(lockedInventoryInfo.save).toHaveBeenCalledOnce();
				expect(PlayerPlantSlots.ensureSlotsForCount).toHaveBeenCalledWith(7, 2);
				expect(response.at(-1)).toBeInstanceOf(CommandShopGenericPurchase);
				expect(response.at(-1)).toMatchObject({
					shopItemId: ShopItemType.PLANT_SLOT_EXTENSION, amount: 1
				});
				expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout)
					.toHaveBeenCalledWith("kc", ShopItemType.PLANT_SLOT_EXTENSION, 1, "city");
			});

			it("should log the purchase without city when the player is travelling", async () => {
				player = buildPlayer(10000, null);
				vi.mocked(Players.getById).mockResolvedValue(player);

				await buyPlantSlot();

				expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout)
					.toHaveBeenCalledWith("kc", ShopItemType.PLANT_SLOT_EXTENSION, 1, undefined);
			});

			it("should refuse the slot when a concurrent purchase reached the maximum", async () => {
				lockedInventoryInfo.plantSlots = PlantConstants.MAX_PLANT_SLOTS;

				const {
					result, response
				} = await buyPlantSlot();

				expect(result).toEqual({ success: false });
				expect(response).toHaveLength(1);
				expect(response[0]).toBeInstanceOf(CommandShopNoPlantSlotAvailable);
				expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
				expect(crowniclesInstance.logsDatabase.logClassicalShopBuyout).not.toHaveBeenCalled();
			});

			it("should refuse the slot when the locked money no longer covers the price", async () => {
				lockedPlayer.money = 2999;
				lockedInventoryInfo.plantSlots = 1;

				const { response } = await buyPlantSlot();

				expect(response).toHaveLength(1);
				expect(response[0]).toMatchObject({
					missingCurrency: 1, currency: ShopCurrency.MONEY
				});
				expect(lockedInventoryInfo.plantSlots).toBe(1);
				expect(PlayerPlantSlots.ensureSlotsForCount).not.toHaveBeenCalled();
			});
		});
	});
});
