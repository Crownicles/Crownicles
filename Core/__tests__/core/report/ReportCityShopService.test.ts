import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logClassicalShopBuyout: vi.fn().mockResolvedValue(undefined),
			logMissionShopBuyout: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/utils/ShopUtils", () => ({
	ShopUtils: { createAndSendShopCollector: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn().mockResolvedValue(undefined),
	updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("../../../src/core/report/MaterialLootGenerator", () => ({
	pickMaterialDistribution: vi.fn()
}));
vi.mock("../../../src/core/utils/GeneralShopItems", () => ({
	getGeneralShopData: vi.fn(),
	getRandomItemShopItem: vi.fn(),
	getDailyPotionShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/TannerShopItems", () => ({
	getSlotExtensionShopItem: vi.fn(),
	getPlantSlotExtensionShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/StockExchangeShopItems", () => ({
	getBadgeShopItem: vi.fn(),
	getMarketAnalysisShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/MissionShopItems", () => ({
	calculateGemsToMoneyRatio: vi.fn().mockReturnValue(42),
	getAThousandPointsShopItem: vi.fn(),
	getMoneyShopItem: vi.fn(),
	getValuableItemShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/MissionManagerShopItems", () => ({
	getMissionSkipShopItem: vi.fn(),
	getQuestMasterBadgeShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/VeterinarianShopItems", () => ({
	getVeterinarianShopItem: vi.fn()
}));
vi.mock("../../../src/core/utils/HerbalistShopItems", () => ({
	getWeeklyPlantShopItems: vi.fn().mockResolvedValue([])
}));
vi.mock("../../../src/core/database/game/models/PlayerTalismans", () => ({
	PlayerTalismansManager: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/utils/ItemUtils", () => ({
	toItemWithDetails: vi.fn().mockReturnValue({ id: 99 })
}));

import {
	handleCityShopReaction, isCityShopEmpty
} from "../../../src/core/report/ReportCityShopService";
import {
	ShopInformations, ShopUtils
} from "../../../src/core/utils/ShopUtils";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";
import { pickMaterialDistribution } from "../../../src/core/report/MaterialLootGenerator";
import {
	getDailyPotionShopItem, getGeneralShopData, getRandomItemShopItem
} from "../../../src/core/utils/GeneralShopItems";
import {
	getPlantSlotExtensionShopItem, getSlotExtensionShopItem
} from "../../../src/core/utils/TannerShopItems";
import {
	getBadgeShopItem, getMarketAnalysisShopItem
} from "../../../src/core/utils/StockExchangeShopItems";
import {
	getAThousandPointsShopItem, getMoneyShopItem, getValuableItemShopItem
} from "../../../src/core/utils/MissionShopItems";
import {
	getMissionSkipShopItem, getQuestMasterBadgeShopItem
} from "../../../src/core/utils/MissionManagerShopItems";
import { getVeterinarianShopItem } from "../../../src/core/utils/VeterinarianShopItems";
import { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import { crowniclesInstance } from "../../../src/app";
import {
	City, CityDataController
} from "../../../src/data/City";
import { MaterialDataController } from "../../../src/data/Material";
import { Potion } from "../../../src/data/Potion";
import { CITY_NPC_VARIANTS } from "../../../src/core/missions/interfaces/visitCityNpc";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	BuyCallbackResult, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ShopConstants, ShopCurrency
} from "../../../../Lib/src/constants/ShopConstants";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	asPlayer, makeHandlerPlayer
} from "./CityHandlerFixture";
import { makeHome } from "../ModelStubs";

const player = makeHandlerPlayer(0);
const context = {} as PacketContext;
const onClose = vi.fn();
const logs = crowniclesInstance?.logsDatabase;

function shopItem(id: ShopItemType, price = 1): ShopItem {
	return {
		id, price, amounts: [1], buyCallback: vi.fn()
	};
}

function getCity(cityId: string, shops?: string[]): City {
	const city = CityDataController.instance.getById(cityId);
	if (!city) {
		throw new Error(`Unknown city ${cityId}`);
	}
	return shops ? Object.assign(Object.create(City.prototype) as City, {
		...city, shops
	}) : city;
}

async function openShop(shopId: string, city: City): Promise<ShopInformations> {
	await handleCityShopReaction({
		player: asPlayer(player), city, shopId, context, response: [], onClose
	});
	const options = vi.mocked(ShopUtils.createAndSendShopCollector).mock.calls[0]?.[2];
	if (!options) {
		throw new Error("No shop was opened");
	}
	return options;
}

function itemsOf(options: ShopInformations): [string, ShopItemType[]][] {
	return options.shopCategories.map(category => [category.id, category.items.map(item => item.id)]);
}

function findItem(options: ShopInformations, id: ShopItemType): ShopItem {
	const item = options.shopCategories.flatMap(category => category.items).find(listed => listed.id === id);
	if (!item) {
		throw new Error(`No shop item ${id}`);
	}
	return item;
}

async function buy(item: ShopItem, amount: number): Promise<{
	result: boolean | BuyCallbackResult; response: CrowniclesPacket[];
}> {
	const response: CrowniclesPacket[] = [];
	const result = await item.buyCallback(response, player.id, context, amount);
	return {
		result, response
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getRandomItemShopItem).mockReturnValue(shopItem(ShopItemType.RANDOM_ITEM));
	vi.mocked(getDailyPotionShopItem).mockReturnValue(shopItem(ShopItemType.DAILY_POTION));
	vi.mocked(getGeneralShopData).mockResolvedValue({
		potion: {} as Potion, remainingPotions: 3
	});
});

describe("handleCityShopReaction", () => {
	it("opens the shop of the city, sends the player back to the city on close and counts the visit", async () => {
		const response: CrowniclesPacket[] = [];

		await handleCityShopReaction({
			player: asPlayer(player), city: getCity("boug_coton"), shopId: "generalShop", context, response, onClose
		});

		expect(ShopUtils.createAndSendShopCollector).toHaveBeenCalledWith(context, response, expect.objectContaining({
			player, cityId: "boug_coton", onClose
		}));
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "visitCityNpc", params: { npc: CITY_NPC_VARIANTS.generalShop }
		});
	});

	it("opens nothing for a shop the city does not have, or an unknown shop", async () => {
		await handleCityShopReaction({
			player: asPlayer(player), city: getCity("boug_coton"), shopId: "tanner", context, response: [], onClose
		});
		await handleCityShopReaction({
			player: asPlayer(player), city: getCity("boug_coton", ["blackMarket"]), shopId: "blackMarket", context, response: [], onClose
		});

		expect(ShopUtils.createAndSendShopCollector).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});

describe("general shop", () => {
	it("sells random equipments and the daily potion, logged as a classical shop", async () => {
		const options = await openShop("generalShop", getCity("boug_coton"));

		expect(itemsOf(options)).toEqual([
			["permanentItem", [ShopItemType.RANDOM_ITEM]],
			["dailyPotion", [ShopItemType.DAILY_POTION]]
		]);
		expect(options.additionalShopData).toEqual({
			remainingPotions: 3, dailyPotion: { id: 99 }
		});
		await options.logger?.(player.keycloakId, ShopItemType.RANDOM_ITEM);
		expect(logs?.logClassicalShopBuyout).toHaveBeenCalled();
	});

	it("does not sell random equipments next to a scrap dealer", async () => {
		const options = await openShop("generalShop", getCity("ville_forte"));

		expect(itemsOf(options)).toEqual([["dailyPotion", [ShopItemType.DAILY_POTION]]]);
	});
});

describe("tanner", () => {
	it("offers only the extensions the player can still buy", async () => {
		const city = getCity("seawynne");
		vi.mocked(getSlotExtensionShopItem).mockResolvedValue(shopItem(ShopItemType.SLOT_EXTENSION));
		vi.mocked(getPlantSlotExtensionShopItem).mockResolvedValue(shopItem(ShopItemType.PLANT_SLOT_EXTENSION));
		const both = itemsOf(await openShop("tanner", city));
		vi.mocked(ShopUtils.createAndSendShopCollector).mockClear();
		vi.mocked(getSlotExtensionShopItem).mockResolvedValue(null);
		const plantsOnly = itemsOf(await openShop("tanner", city));
		vi.mocked(ShopUtils.createAndSendShopCollector).mockClear();
		vi.mocked(getPlantSlotExtensionShopItem).mockResolvedValue(null);
		vi.mocked(getSlotExtensionShopItem).mockResolvedValue(shopItem(ShopItemType.SLOT_EXTENSION));
		const slotsOnly = itemsOf(await openShop("tanner", city));

		expect(both).toEqual([["slotExtension", [ShopItemType.SLOT_EXTENSION]], ["plantSlotExtension", [ShopItemType.PLANT_SLOT_EXTENSION]]]);
		expect(plantsOnly).toEqual([["plantSlotExtension", [ShopItemType.PLANT_SLOT_EXTENSION]]]);
		expect(slotsOnly).toEqual([["slotExtension", [ShopItemType.SLOT_EXTENSION]]]);
	});

	it("is empty only once both extensions are bought out, the other shops never are", async () => {
		vi.mocked(getSlotExtensionShopItem).mockResolvedValue(null);
		vi.mocked(getPlantSlotExtensionShopItem).mockResolvedValue(shopItem(ShopItemType.PLANT_SLOT_EXTENSION));
		const oneLeft = await isCityShopEmpty(asPlayer(player), "tanner");
		vi.mocked(getPlantSlotExtensionShopItem).mockResolvedValue(null);
		const boughtOut = await isCityShopEmpty(asPlayer(player), "tanner");

		expect([oneLeft, boughtOut]).toEqual([false, true]);
		expect(await isCityShopEmpty(asPlayer(player), "generalShop")).toBe(false);
		expect(await isCityShopEmpty(asPlayer(player), "blackMarket")).toBe(false);
	});
});

describe("material shops", () => {
	it("sells common and uncommon wood at their price and gives exactly the bought amount of wood of that rarity", async () => {
		const options = await openShop("lumberjack", getCity("coco_village"));
		const common = findItem(options, ShopItemType.WOOD_COMMON_BUNDLE);
		const uncommon = findItem(options, ShopItemType.WOOD_UNCOMMON_BUNDLE);

		expect([common.price, uncommon.price]).toEqual([ShopConstants.LUMBERJACK_PRICES.COMMON, ShopConstants.LUMBERJACK_PRICES.UNCOMMON]);
		expect(common.amounts).toEqual(ShopConstants.LUMBERJACK_AMOUNTS);
		for (const [item, rarity] of [[common, MaterialRarity.COMMON], [uncommon, MaterialRarity.UNCOMMON]] as const) {
			vi.mocked(applyMaterialLoot).mockClear();
			const { result, response } = await buy(item, 25);
			const loot = vi.mocked(applyMaterialLoot).mock.calls[0][1];
			const allowed = MaterialDataController.instance.getMaterialsFromType(MaterialType.WOOD)
				.filter(material => material.rarity === rarity)
				.map(material => parseInt(material.id, 10));

			expect(loot.reduce((sum, material) => sum + material.quantity, 0)).toBe(25);
			expect(loot.every(material => allowed.includes(material.materialId))).toBe(true);
			expect(applyMaterialLoot).toHaveBeenCalledWith(player.id, loot);
			expect(updateCollectMaterialsMission).toHaveBeenCalledWith(player, response, loot);
			expect(result).toEqual({
				success: true, materials: Object.fromEntries(loot.map(material => [String(material.materialId), material.quantity]))
			});
		}
	});

	it("sells random material packs at the unit price", async () => {
		const options = await openShop("materialMerchant", getCity("ville_forte"));
		const pack = findItem(options, ShopItemType.RANDOM_MATERIAL_PACK);
		vi.mocked(pickMaterialDistribution).mockReturnValue(new Map([[3, 7], [5, 3]]));

		const { result } = await buy(pack, 10);

		expect([pack.price, pack.amounts]).toEqual([ShopConstants.MATERIAL_MERCHANT_PRICE_PER_UNIT, ShopConstants.MATERIAL_MERCHANT_AMOUNTS]);
		expect(pickMaterialDistribution).toHaveBeenCalledWith(10);
		expect(applyMaterialLoot).toHaveBeenCalledWith(player.id, [
			{
				materialId: 3, quantity: 7
			},
			{
				materialId: 5, quantity: 3
			}
		]);
		expect(result).toEqual({
			success: true, materials: {
				3: 7, 5: 3
			}
		});
	});
});

describe("herbalist", () => {
	it("sells the remote harvest talisman only to a player with a garden and grants it once bought", async () => {
		const talismans = {
			hasRemoteHarvestTalisman: false, save: vi.fn().mockResolvedValue(undefined)
		};

		// The herbalist only reads and saves the talisman flag of the talismans row
		vi.mocked(PlayerTalismansManager.getOfPlayer).mockResolvedValue(talismans as unknown as Awaited<ReturnType<typeof PlayerTalismansManager.getOfPlayer>>);
		const options = await openShop("herbalist", getCity("coco_village"));
		const talisman = findItem(options, ShopItemType.REMOTE_HARVEST_TALISMAN);

		// A level 1 home has no garden plot, a level 2 one has some
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(makeHome({
			cityId: "coco_village", level: 1
		}));
		const noGarden = await buy(talisman, 1);
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);
		const homeless = await buy(talisman, 1);
		expect(talismans.hasRemoteHarvestTalisman).toBe(false);
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(makeHome({
			cityId: "coco_village", level: 2
		}));
		const bought = await buy(talisman, 1);

		expect(talisman.price).toBe(GardenConstants.REMOTE_HARVEST_TALISMAN_PRICE);
		for (const refused of [noGarden, homeless]) {
			expect(refused.result).toEqual({ success: false });
			expect(refused.response.map(packet => packet.constructor.name)).toEqual(["CommandShopNoGardenForRemoteHarvestTalisman"]);
		}
		expect(bought.result).toEqual({ success: true });
		expect(talismans.hasRemoteHarvestTalisman).toBe(true);
		expect(talismans.save).toHaveBeenCalled();
		expect(MissionsController.update).toHaveBeenCalledWith(player, bought.response, { missionId: "haveGardenTalisman" });
	});

	it("does not sell the talisman twice", async () => {
		vi.mocked(PlayerTalismansManager.getOfPlayer).mockResolvedValue({ hasRemoteHarvestTalisman: true } as Awaited<ReturnType<typeof PlayerTalismansManager.getOfPlayer>>);

		const options = await openShop("herbalist", getCity("coco_village"));

		expect(itemsOf(options)).toEqual([["weeklyPlants", []]]);
		expect(options.additionalShopData?.weeklyPlants).toHaveLength(3);
	});
});

describe("gem shops", () => {
	it("sells the royal market items for gems, with the gem rate, logged as a mission shop", async () => {
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ missionSkipsUsedThisWeek: 2 } as Awaited<ReturnType<typeof PlayerMissionsInfos.getOfPlayer>>);
		vi.mocked(getMoneyShopItem).mockReturnValue(shopItem(ShopItemType.MONEY));
		vi.mocked(getValuableItemShopItem).mockReturnValue(shopItem(ShopItemType.TREASURE));
		vi.mocked(getMissionSkipShopItem).mockReturnValue(shopItem(ShopItemType.SKIP_MISSION));
		vi.mocked(getAThousandPointsShopItem).mockReturnValue(shopItem(ShopItemType.KINGS_FAVOR));
		vi.mocked(getQuestMasterBadgeShopItem).mockResolvedValue(shopItem(ShopItemType.QUEST_MASTER_BADGE));

		const options = await openShop("royalMarket", getCity("royal_castle"));

		expect(getMissionSkipShopItem).toHaveBeenCalledWith(2);
		expect(itemsOf(options)).toEqual([
			["resources", [ShopItemType.MONEY, ShopItemType.TREASURE]],
			["services", [ShopItemType.SKIP_MISSION]],
			["prestige", [ShopItemType.KINGS_FAVOR, ShopItemType.QUEST_MASTER_BADGE]]
		]);
		expect(options.additionalShopData).toEqual({
			gemToMoneyRatio: 42, currency: ShopCurrency.GEM
		});
		await options.logger?.(player.keycloakId, ShopItemType.MONEY);
		expect(logs?.logMissionShopBuyout).toHaveBeenCalled();
	});

	it("hides the quest master badge once owned", async () => {
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ missionSkipsUsedThisWeek: 0 } as Awaited<ReturnType<typeof PlayerMissionsInfos.getOfPlayer>>);
		vi.mocked(getAThousandPointsShopItem).mockReturnValue(shopItem(ShopItemType.KINGS_FAVOR));
		vi.mocked(getQuestMasterBadgeShopItem).mockResolvedValue(null);

		const options = await openShop("royalMarket", getCity("royal_castle"));

		expect(options.shopCategories.find(category => category.id === "prestige")?.items.map(item => item.id)).toEqual([ShopItemType.KINGS_FAVOR]);
	});

	it("lists the stock exchange badge only while it can be bought", async () => {
		const city = getCity("claire_de_ville");
		vi.mocked(getMarketAnalysisShopItem).mockReturnValue(shopItem(ShopItemType.MARKET_ANALYSIS));
		vi.mocked(getBadgeShopItem).mockResolvedValue(shopItem(ShopItemType.MONEY_MOUTH_BADGE));
		const withBadge = await openShop("stockExchange", city);
		vi.mocked(ShopUtils.createAndSendShopCollector).mockClear();
		vi.mocked(getBadgeShopItem).mockResolvedValue(null);
		const withoutBadge = await openShop("stockExchange", city);

		expect(itemsOf(withBadge)).toEqual([["permanentItem", [ShopItemType.MONEY_MOUTH_BADGE]], ["services", [ShopItemType.MARKET_ANALYSIS]]]);
		expect(itemsOf(withoutBadge)).toEqual([["permanentItem", []], ["services", [ShopItemType.MARKET_ANALYSIS]]]);
		expect(withBadge.additionalShopData).toEqual({ gemToMoneyRatio: 42 });
	});

	it("sells the veterinarian services for gems", async () => {
		vi.mocked(getVeterinarianShopItem).mockReturnValue(shopItem(ShopItemType.LOVE_POINTS_VALUE));

		const options = await openShop("veterinarian", getCity("seawynne"));

		expect(itemsOf(options)).toEqual([["services", [ShopItemType.LOVE_POINTS_VALUE]]]);
		expect(options.additionalShopData).toEqual({ currency: ShopCurrency.GEM });
	});
});
