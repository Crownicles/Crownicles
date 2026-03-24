import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import { ShopUtils } from "../utils/ShopUtils";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import {
	ShopCategory, CommandShopNoPlantSlotAvailable
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	calculateGemsToMoneyRatio,
	getAThousandPointsShopItem,
	getMoneyShopItem,
	getValuableItemShopItem
} from "../utils/MissionShopItems";
import {
	getDailyPotionShopItem,
	getGeneralShopData,
	getRandomItemShopItem
} from "../utils/GeneralShopItems";
import {
	getBadgeShopItem, getMarketAnalysisShopItem
} from "../utils/StockExchangeShopItems";
import {
	getPlantSlotExtensionShopItem, getSlotExtensionShopItem
} from "../utils/TannerShopItems";
import { crowniclesInstance } from "../../index";
import { toItemWithDetails } from "../utils/ItemUtils";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import {
	PlantConstants, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MaterialDataController } from "../../data/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../database/game/models/Material";

/**
 * Parameters for handleCityShopReaction
 */
export interface CityShopReactionParams {
	player: Player;
	city: City;
	shopId: string;
	context: PacketContext;
	response: CrowniclesPacket[];
}

export async function handleCityShopReaction(params: CityShopReactionParams): Promise<void> {
	const {
		player, city, shopId, context, response
	} = params;
	if (!city.shops?.includes(shopId)) {
		CrowniclesLogger.warn(`Player tried to access unknown shop ${shopId} in city ${city.id}`);
		return;
	}

	switch (shopId) {
		case "royalMarket":
			await openRoyalMarket(player, context, response);
			break;
		case "generalShop":
			await openGeneralShop(player, context, response);
			break;
		case "stockExchange":
			await openStockExchange(player, context, response);
			break;
		case "tanner":
			await openTanner(player, context, response);
			break;
		case "herbalist":
			await openHerbalist(player, context, response);
			break;
		case "lumberjack":
			await openLumberjack(player, context, response);
			break;
		default:
			CrowniclesLogger.error(`Unhandled city shop ${shopId}`);
			break;
	}
}

/**
 * Open the royal market shop for the player
 */
export async function openRoyalMarket(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "resources",
			items: [
				getMoneyShopItem(),
				getValuableItemShopItem()
			]
		},
		{
			id: "prestige",
			items: [getAThousandPointsShopItem()]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			currency: ShopCurrency.GEM,
			gemToMoneyRatio: calculateGemsToMoneyRatio()
		}
	});
}

/**
 * Open the general shop for the player (daily potion + random equipment)
 */
export async function openGeneralShop(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const {
		potion, remainingPotions
	} = await getGeneralShopData(player.keycloakId);

	const shopCategories: ShopCategory[] = [
		{
			id: "permanentItem",
			items: [getRandomItemShopItem()]
		},
		{
			id: "dailyPotion",
			items: [getDailyPotionShopItem(potion)]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			remainingPotions,
			dailyPotion: toItemWithDetails(player, potion, 0, null)
		}
	});
}

/**
 * Open the stock exchange shop for the player (money mouth badge + gem exchange rate info)
 */
export async function openStockExchange(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "permanentItem",
			items: [getBadgeShopItem()]
		},
		{
			id: "services",
			items: [getMarketAnalysisShopItem()]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			gemToMoneyRatio: calculateGemsToMoneyRatio()
		}
	});
}

/**
 * Open the tanner shop for the player (inventory slot extensions + plant slot extensions)
 */
export async function openTanner(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const slotExtensionItem = await getSlotExtensionShopItem(player.id);
	const plantSlotExtensionItem = await getPlantSlotExtensionShopItem(player.id);

	const shopCategories: ShopCategory[] = [];

	if (slotExtensionItem) {
		shopCategories.push({
			id: "slotExtension",
			items: [slotExtensionItem]
		});
	}

	if (plantSlotExtensionItem) {
		shopCategories.push({
			id: "plantSlotExtension",
			items: [plantSlotExtensionItem]
		});
	}

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase)
	});
}

/**
 * Open the herbalist shop for the player (weekly rotating plants)
 */
export async function openHerbalist(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const weeklyPlants = PlantConstants.getWeeklyHerbalistPlants();

	const tierTypes: ShopItemType[] = [
		ShopItemType.WEEKLY_PLANT_TIER_1,
		ShopItemType.WEEKLY_PLANT_TIER_2,
		ShopItemType.WEEKLY_PLANT_TIER_3
	];

	const shopCategories: ShopCategory[] = [
		{
			id: "weeklyPlants",
			items: weeklyPlants.map((plant: PlantType, index: number) => ({
				id: tierTypes[index],
				price: PlantConstants.getHerbalistPrice(plant),
				amounts: [1],
				buyCallback: async (buyResponse: CrowniclesPacket[], playerId: number): Promise<boolean> => {
					const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(playerId);
					if (!emptySlot) {
						buyResponse.push(makePacket(CommandShopNoPlantSlotAvailable, {}));
						return false;
					}
					await PlayerPlantSlots.setPlant(playerId, emptySlot.slot, plant.id);
					return true;
				}
			}))
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			weeklyPlants: weeklyPlants.map((p: PlantType) => p.id)
		}
	});
}

/**
 * Open the lumberjack shop for the player (wood bundles)
 */
export async function openLumberjack(player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const woodMaterials = MaterialDataController.instance.getMaterialsFromType(MaterialType.WOOD);

	const commonWoods = woodMaterials.filter(m => m.rarity === MaterialRarity.COMMON);
	const uncommonWoods = woodMaterials.filter(m => m.rarity === MaterialRarity.UNCOMMON);
	const rareWoods = woodMaterials.filter(m => m.rarity === MaterialRarity.RARE);

	const shopCategories: ShopCategory[] = [
		{
			id: "woodBundles",
			items: [
				{
					id: ShopItemType.WOOD_COMMON_BUNDLE,
					price: 50,
					amounts: [1],
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number): Promise<boolean> => {
						const picked = RandomUtils.crowniclesRandom.pick(commonWoods);
						await Materials.giveMaterial(playerId, parseInt(picked.id as string, 10), 5);
						return true;
					}
				},
				{
					id: ShopItemType.WOOD_UNCOMMON_BUNDLE,
					price: 100,
					amounts: [1],
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number): Promise<boolean> => {
						const picked = RandomUtils.crowniclesRandom.pick(uncommonWoods);
						await Materials.giveMaterial(playerId, parseInt(picked.id as string, 10), 3);
						return true;
					}
				},
				{
					id: ShopItemType.WOOD_RARE_BUNDLE,
					price: 200,
					amounts: [1],
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number): Promise<boolean> => {
						const picked = RandomUtils.crowniclesRandom.pick(rareWoods);
						await Materials.giveMaterial(playerId, parseInt(picked.id as string, 10), 2);
						return true;
					}
				}
			]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase)
	});
}
