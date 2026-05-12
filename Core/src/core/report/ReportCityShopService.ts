import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import { ShopUtils } from "../utils/ShopUtils";
import {
	ShopConstants, ShopCurrency
} from "../../../../Lib/src/constants/ShopConstants";
import {
	BuyCallbackResult, MaterialDistribution, ShopCategory, CommandShopNoPlantSlotAvailable
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
import {
	Material, MaterialDataController
} from "../../data/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../database/game/models/Material";
import { getVeterinarianShopItem } from "../utils/VeterinarianShopItems";
import {
	getMissionSkipShopItem, getQuestMasterBadgeShopItem
} from "../utils/MissionManagerShopItems";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { pickMaterialDistribution } from "./MaterialLootGenerator";

/**
 * Cached materials by type and rarity (constant after data loading, computed once per key)
 */
const materialsByTypeAndRarityCache = new Map<string, Material[]>();

function buildMaterialCacheKey(type: MaterialType, rarity: MaterialRarity): string {
	return `${type}_${rarity}`;
}

function getMaterialsByTypeAndRarity(type: MaterialType, rarity: MaterialRarity): Material[] {
	const key = buildMaterialCacheKey(type, rarity);
	let materials = materialsByTypeAndRarityCache.get(key);
	if (!materials) {
		materials = MaterialDataController.instance.getMaterialsFromType(type).filter(m => m.rarity === rarity);
		materialsByTypeAndRarityCache.set(key, materials);
	}
	return materials;
}

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

const CITY_SHOP_TYPES = [
	"royalMarket",
	"generalShop",
	"stockExchange",
	"tanner",
	"herbalist",
	"lumberjack",
	"veterinarian",
	"materialMerchant",
	"missionManager"
] as const;
type CityShopType = typeof CITY_SHOP_TYPES[number];

const SHOP_HANDLERS: Record<CityShopType, (player: Player, context: PacketContext, response: CrowniclesPacket[], city: City) => Promise<void>> = {
	royalMarket: openRoyalMarket,
	generalShop: openGeneralShop,
	stockExchange: openStockExchange,
	tanner: openTanner,
	herbalist: openHerbalist,
	lumberjack: openLumberjack,
	veterinarian: openVeterinarian,
	materialMerchant: openMaterialMerchant,
	missionManager: openMissionManager
};

function isCityShopType(shopId: string): shopId is CityShopType {
	return (CITY_SHOP_TYPES as readonly string[]).includes(shopId);
}

export async function handleCityShopReaction(params: CityShopReactionParams): Promise<void> {
	const {
		player, city, shopId, context, response
	} = params;
	if (!city.shops?.includes(shopId)) {
		CrowniclesLogger.warn(`Player tried to access unknown shop ${shopId} in city ${city.id}`);
		return;
	}

	const handler = isCityShopType(shopId) ? SHOP_HANDLERS[shopId] : undefined;
	if (!handler) {
		CrowniclesLogger.error(`Unhandled city shop ${shopId}`);
		return;
	}
	await handler(player, context, response, city);
}

interface GemShopOptions {
	player: Player;
	context: PacketContext;
	response: CrowniclesPacket[];
	shopCategories: ShopCategory[];
	additionalShopData?: Record<string, unknown>;
}

/**
 * Open a gem-based shop with gemToMoneyRatio in additional data
 */
async function openGemShop({
	player,
	context,
	response,
	shopCategories,
	additionalShopData
}: GemShopOptions): Promise<void> {
	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			gemToMoneyRatio: calculateGemsToMoneyRatio(),
			...additionalShopData
		}
	});
}

/**
 * Open the royal market shop for the player
 */
export async function openRoyalMarket(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	await openGemShop({
		player,
		context,
		response,
		shopCategories: [
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
		],
		additionalShopData: { currency: ShopCurrency.GEM }
	});
}

/**
 * Open the general shop for the player (daily potion + random equipment)
 */
export async function openGeneralShop(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
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
export async function openStockExchange(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	await openGemShop({
		player,
		context,
		response,
		shopCategories: [
			{
				id: "permanentItem",
				items: [getBadgeShopItem()]
			},
			{
				id: "services",
				items: [getMarketAnalysisShopItem()]
			}
		]
	});
}

/**
 * Open the tanner shop for the player (inventory slot extensions + plant slot extensions)
 */
export async function openTanner(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
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
export async function openHerbalist(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
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
 * Distribute a total quantity randomly among a list of materials and give them to the player.
 */
async function distributeMaterialsRandomly(playerId: number, materials: Material[], totalQuantity: number): Promise<MaterialDistribution> {
	const distribution = new Map<number, number>();
	for (let i = 0; i < totalQuantity; i++) {
		const picked = RandomUtils.crowniclesRandom.pick(materials);
		const materialId = parseInt(picked.id as string, 10);
		distribution.set(materialId, (distribution.get(materialId) ?? 0) + 1);
	}
	for (const [materialId, quantity] of distribution) {
		await Materials.giveMaterial(playerId, materialId, quantity);
	}
	return Object.fromEntries([...distribution].map(([k, v]) => [String(k), v]));
}

/**
 * Open the lumberjack shop for the player (wood by rarity with quantity selection)
 */
export async function openLumberjack(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "woodBundles",
			items: [
				{
					id: ShopItemType.WOOD_COMMON_BUNDLE,
					price: ShopConstants.LUMBERJACK_PRICES.COMMON,
					amounts: ShopConstants.LUMBERJACK_AMOUNTS,
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number, _context: PacketContext, amount: number): Promise<BuyCallbackResult> => ({
						success: true,
						materials: await distributeMaterialsRandomly(playerId, getMaterialsByTypeAndRarity(MaterialType.WOOD, MaterialRarity.COMMON), amount)
					})
				},
				{
					id: ShopItemType.WOOD_UNCOMMON_BUNDLE,
					price: ShopConstants.LUMBERJACK_PRICES.UNCOMMON,
					amounts: ShopConstants.LUMBERJACK_AMOUNTS,
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number, _context: PacketContext, amount: number): Promise<BuyCallbackResult> => ({
						success: true,
						materials: await distributeMaterialsRandomly(playerId, getMaterialsByTypeAndRarity(MaterialType.WOOD, MaterialRarity.UNCOMMON), amount)
					})
				},
				{
					id: ShopItemType.WOOD_RARE_BUNDLE,
					price: ShopConstants.LUMBERJACK_PRICES.RARE,
					amounts: ShopConstants.LUMBERJACK_AMOUNTS,
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number, _context: PacketContext, amount: number): Promise<BuyCallbackResult> => ({
						success: true,
						materials: await distributeMaterialsRandomly(playerId, getMaterialsByTypeAndRarity(MaterialType.WOOD, MaterialRarity.RARE), amount)
					})
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

/**
 * Open the veterinarian shop for the player (pet information + love points boost)
 */
export async function openVeterinarian(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "services",
			items: [getVeterinarianShopItem()]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		additionalShopData: {
			currency: ShopCurrency.GEM
		}
	});
}

/**
 * Generate a random material following natural drop rates and give it to the player.
 * Drop rates: 60% common, 30% uncommon, 10% rare.
 */
async function generateRandomMaterialsForPlayer(playerId: number, totalQuantity: number): Promise<MaterialDistribution> {
	const distribution = pickMaterialDistribution(totalQuantity);
	for (const [materialId, quantity] of distribution) {
		await Materials.giveMaterial(playerId, materialId, quantity);
	}
	return Object.fromEntries([...distribution].map(([k, v]) => [String(k), v]));
}

/**
 * Open the material merchant shop for the player (random material packs)
 */
export async function openMaterialMerchant(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	const shopCategories: ShopCategory[] = [
		{
			id: "materialPacks",
			items: [
				{
					id: ShopItemType.RANDOM_MATERIAL_PACK,
					price: ShopConstants.MATERIAL_MERCHANT_PRICE_PER_UNIT,
					amounts: ShopConstants.MATERIAL_MERCHANT_AMOUNTS,
					buyCallback: async (_buyResponse: CrowniclesPacket[], playerId: number, _context: PacketContext, amount: number): Promise<BuyCallbackResult> => ({
						success: true,
						materials: await generateRandomMaterialsForPlayer(playerId, amount)
					})
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

/**
 * Open the mission manager shop for the player (mission skips + quest master badge)
 */
export async function openMissionManager(player: Player, context: PacketContext, response: CrowniclesPacket[], _city: City): Promise<void> {
	const playerMissionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	await openGemShop({
		player,
		context,
		response,
		shopCategories: [
			{
				id: "services",
				items: [getMissionSkipShopItem(playerMissionsInfo.missionSkipsUsedThisWeek)]
			},
			{
				id: "prestige",
				items: [getQuestMasterBadgeShopItem()]
			}
		],
		additionalShopData: { currency: ShopCurrency.GEM }
	});
}
