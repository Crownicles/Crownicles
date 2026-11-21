import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { ShopUtils } from "../../../src/core/utils/ShopUtils";
import Player from "../../../src/core/database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";
import {
	CommandShopClosed,
	CommandShopGenericPurchase,
	CommandShopNotEnoughCurrency,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopItemReaction,
	ShopCategory,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";

type CollectorReaction = {
	reaction: {
		type: string; data: unknown;
	};
} | null;

type CapturedCollector = {
	packet: {
		data: { data: { availableCurrency: number } };
	};
	options: { allowedPlayerKeycloakIds: string[] };
	block: [string, string];
	endCallback: (collector: { getFirstReaction: () => CollectorReaction }, response: CrowniclesPacket[]) => Promise<void>;
};

let captured: Partial<CapturedCollector> = {};

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(collector: { creationPacket: (id: string, endTime: number) => CapturedCollector["packet"] }, _context: unknown, options: CapturedCollector["options"], endCallback: CapturedCollector["endCallback"]) {
			captured.packet = collector.creationPacket("collector", 0);
			captured.options = options;
			captured.endCallback = endCallback;
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

const context = { keycloakId: "kc" } as PacketContext;

/**
 * Build a player holding the given money, as loaded from the database
 */
function buildPlayer(money: number): Player {
	return Object.assign(Object.create(Player.prototype) as Player, {
		id: 7,
		keycloakId: "kc",
		money,
		spendMoney: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	});
}

/**
 * Build the missions info of the player holding the given gems
 */
function buildMissionsInfo(gems: number): PlayerMissionsInfo {
	return Object.assign(Object.create(PlayerMissionsInfo.prototype) as PlayerMissionsInfo, {
		playerId: 7,
		gems,
		spendGems: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	});
}

/**
 * A shop item whose buy callback returns the given result
 */
function shopItem(id: ShopItemType, price: number, result: ReturnType<ShopItem["buyCallback"]> = true): ShopItem {
	return {
		id,
		price,
		amounts: [1],
		buyCallback: vi.fn().mockResolvedValue(result)
	};
}

/**
 * The reaction of the player buying `amount` times an item of a category
 */
function buyReaction(shopCategoryId: string, shopItemId: ShopItemType, price: number, amount = 1): CollectorReaction {
	return {
		reaction: {
			type: ReactionCollectorShopItemReaction.name,
			data: {
				shopCategoryId, shopItemId, price, amount
			}
		}
	};
}

/**
 * End the shop collector with the given reaction and return the packets it pushed
 */
async function endShop(reaction: CollectorReaction): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await captured.endCallback!({ getFirstReaction: () => reaction }, response);
	return response;
}

describe("ShopUtils.createAndSendShopCollector", () => {
	let player: Player;
	let potion: ShopItem;
	let categories: ShopCategory[];

	beforeEach(() => {
		vi.clearAllMocks();
		captured = {};
		player = buildPlayer(1000);
		potion = shopItem(ShopItemType.DAILY_POTION, 300);
		categories = [
			{
				id: "permanent", items: [shopItem(ShopItemType.RANDOM_ITEM, 50)]
			},
			{
				id: "daily", items: [shopItem(ShopItemType.RANDOM_ITEM, 70), potion]
			}
		];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should open a blocking shop showing the money of the player", async () => {
		const response: CrowniclesPacket[] = [];

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories: categories, player
		});

		expect(response).toHaveLength(1);
		expect(captured.packet?.data.data.availableCurrency).toBe(1000);
		expect(captured.options).toEqual({ allowedPlayerKeycloakIds: ["kc"] });
		expect(captured.block).toEqual(["kc", BlockingConstants.REASONS.SHOP]);
	});

	it.each([
		["closed", {
			reaction: {
				type: ReactionCollectorShopCloseReaction.name, data: {}
			}
		}],
		["ignored", null]
	])("should unblock the player and close the shop when it is %s", async (_name, reaction) => {
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player
		});

		const response = await endShop(reaction);

		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("kc", BlockingConstants.REASONS.SHOP);
		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("kc", BlockingConstants.REASONS.SHOP_CONFIRMATION);
		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandShopClosed);
		expect(potion.buyCallback).not.toHaveBeenCalled();
	});

	it("should let the caller replace the closing of the shop", async () => {
		const onClose = vi.fn().mockResolvedValue(undefined);
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player, onClose
		});

		const response = await endShop(null);

		expect(onClose).toHaveBeenCalledWith(response);
		expect(response).toEqual([]);
	});

	it("should refuse a purchase the player cannot afford", async () => {
		const logger = vi.fn().mockResolvedValue(undefined);
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player, logger
		});

		const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 1250));

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandShopNotEnoughCurrency);
		expect(response[0]).toMatchObject({
			missingCurrency: 250, currency: ShopCurrency.MONEY
		});
		expect(potion.buyCallback).not.toHaveBeenCalled();
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(logger).not.toHaveBeenCalled();
	});

	it("should buy the chosen item of the chosen category and charge its price", async () => {
		const logger = vi.fn().mockResolvedValue(undefined);
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player, logger, cityId: "city"
		});

		// The player has exactly the price
		const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 1000, 2));

		expect(potion.buyCallback).toHaveBeenCalledWith(response, 7, context, 2);
		expect(categories[0].items[0].buyCallback).not.toHaveBeenCalled();
		expect(categories[1].items[0].buyCallback).not.toHaveBeenCalled();
		expect(player.spendMoney).toHaveBeenCalledWith({
			amount: 1000, reason: NumberChangeReason.SHOP, response
		});
		expect(player.save).toHaveBeenCalledOnce();
		expect(logger).toHaveBeenCalledWith("kc", ShopItemType.DAILY_POTION, 2, "city");
		// A simple boolean result lets the buy callback answer the player itself
		expect(response).toEqual([]);
	});

	it("should not charge nor log a failed purchase", async () => {
		potion = shopItem(ShopItemType.DAILY_POTION, 300, false);
		categories[1].items[1] = potion;
		const logger = vi.fn().mockResolvedValue(undefined);
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player, logger
		});

		await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 300));

		expect(potion.buyCallback).toHaveBeenCalledOnce();
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(logger).not.toHaveBeenCalled();
	});

	it("should not charge a detailed failed purchase", async () => {
		potion = shopItem(ShopItemType.DAILY_POTION, 300, { success: false });
		categories[1].items[1] = potion;
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player
		});

		const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 300));

		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(response).toEqual([]);
	});

	it("should not charge again a purchase already paid by the buy callback, and announce it", async () => {
		const postPurchase = vi.fn().mockResolvedValue(undefined);
		const materials = { 3: 2 };
		potion = shopItem(ShopItemType.DAILY_POTION, 300, {
			success: true, currencySpent: true, materials, plantsSentToHomeStorage: 2, postPurchase
		} as ReturnType<ShopItem["buyCallback"]>);
		categories[1].items[1] = potion;
		const logger = vi.fn().mockResolvedValue(undefined);
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player, logger
		});

		const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 300, 3));

		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(postPurchase).toHaveBeenCalledOnce();
		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandShopGenericPurchase);
		expect({ ...response[0] }).toEqual({
			shopItemId: ShopItemType.DAILY_POTION,
			amount: 3,
			materials,
			plantsSentToHomeStorage: 2,
			translationParams: undefined
		});
		expect(logger).toHaveBeenCalledWith("kc", ShopItemType.DAILY_POTION, 3, undefined);
	});

	it("should charge a detailed purchase not paid by the buy callback without plants sent home", async () => {
		potion = shopItem(ShopItemType.DAILY_POTION, 300, { success: true });
		categories[1].items[1] = potion;
		await ShopUtils.createAndSendShopCollector(context, [], {
			shopCategories: categories, player
		});

		const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 300));

		expect(player.spendMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 300 }));
		expect((response[0] as CommandShopGenericPurchase).plantsSentToHomeStorage).toBeUndefined();
	});

	describe("weekly plants", () => {
		/**
		 * Buy a plant tier of the herbalist shop and return the purchase packet
		 */
		async function buyPlantTier(tier: ShopItemType, weeklyPlants?: number[]): Promise<CrowniclesPacket> {
			const plant = shopItem(tier, 100, { success: true });
			await ShopUtils.createAndSendShopCollector(context, [], {
				shopCategories: [{
					id: "plants", items: [plant]
				}],
				player,
				additionalShopData: { weeklyPlants }
			});
			return (await endShop(buyReaction("plants", tier, 100)))[0];
		}

		it.each([
			[ShopItemType.WEEKLY_PLANT_TIER_1, "3"],
			[ShopItemType.WEEKLY_PLANT_TIER_2, "5"],
			[ShopItemType.WEEKLY_PLANT_TIER_3, "7"]
		])("should name the plant of the bought tier %s", async (tier, plantId) => {
			expect(await buyPlantTier(tier, [3, 5, 7])).toMatchObject({ translationParams: { plantId } });
		});

		it("should not name a plant when the weekly plants are unknown", async () => {
			expect((await buyPlantTier(ShopItemType.WEEKLY_PLANT_TIER_2)) as CommandShopGenericPurchase).toHaveProperty("translationParams", undefined);
		});

		it.each([
			ShopItemType.WEEKLY_PLANT_TIER_1 - 1,
			ShopItemType.WEEKLY_PLANT_TIER_3 + 1
		])("should not name a plant for the item %s outside the plant tiers", async itemId => {
			expect((await buyPlantTier(itemId, [3, 5, 7, 9, 11])) as CommandShopGenericPurchase).toHaveProperty("translationParams", undefined);
		});
	});

	describe("gem shop", () => {
		it("should show the gems of the player and charge the fresh gems after the purchase", async () => {
			const openingInfo = buildMissionsInfo(40);
			const freshInfo = buildMissionsInfo(45);
			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValueOnce(openingInfo).mockResolvedValueOnce(freshInfo);
			await ShopUtils.createAndSendShopCollector(context, [], {
				shopCategories: categories, player, additionalShopData: { currency: ShopCurrency.GEM }
			});

			expect(captured.packet?.data.data.availableCurrency).toBe(40);
			const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 40));

			expect(PlayerMissionsInfos.getOfPlayer).toHaveBeenCalledWith(7);
			expect(freshInfo.spendGems).toHaveBeenCalledWith(40, response, NumberChangeReason.MISSION_SHOP);
			expect(freshInfo.save).toHaveBeenCalledOnce();
			expect(openingInfo.spendGems).not.toHaveBeenCalled();
			expect(player.spendMoney).not.toHaveBeenCalled();
		});

		it("should refuse a purchase costing more gems than the player has", async () => {
			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue(buildMissionsInfo(40));
			await ShopUtils.createAndSendShopCollector(context, [], {
				shopCategories: categories, player, additionalShopData: { currency: ShopCurrency.GEM }
			});

			const response = await endShop(buyReaction("daily", ShopItemType.DAILY_POTION, 41));

			expect(response[0]).toMatchObject({
				missingCurrency: 1, currency: ShopCurrency.GEM
			});
			expect(potion.buyCallback).not.toHaveBeenCalled();
		});
	});
});
