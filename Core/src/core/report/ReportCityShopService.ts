import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	OnShopCloseCallback, ShopUtils
} from "../utils/ShopUtils";
import {
	ShopConstants, ShopCurrency
} from "../../../../Lib/src/constants/ShopConstants";
import {
	BuyCallbackResult,
	CommandShopNoGardenForRemoteHarvestTalisman,
	CommandShopNoPlantSlotAvailable,
	MaterialDistribution,
	ShopCategory
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
import { crowniclesInstance } from "../../app";
import { toItemWithDetails } from "../utils/ItemUtils";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import { PlayerTalismansManager } from "../database/game/models/PlayerTalismans";
import {
	PlantConstants, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MissionsController } from "../missions/MissionsController";
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
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { Homes } from "../database/game/models/Home";

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

	/*
	 * Called when the city shop is closed by the player or expires
	 * without any purchase. Used by the city flow to re-open the main
	 * city menu so the close button returns to the city instead of
	 * dismissing the UI (#4268).
	 */
	onClose: OnShopCloseCallback;
}

/**
 * Shared context passed to every city shop opener. Bundles the player
 * state, city, MQTT context, response buffer and the "back to city"
 * callback so each opener has a single argument (#4268).
 */
interface CityShopOpenerContext {
	player: Player;
	city: City;
	context: PacketContext;
	response: CrowniclesPacket[];
	onClose: OnShopCloseCallback;
}

const CITY_SHOP_TYPES = [
	"royalMarket",
	"generalShop",
	"stockExchange",
	"tanner",
	"herbalist",
	"lumberjack",
	"veterinarian",
	"materialMerchant"
] as const;
type CityShopType = typeof CITY_SHOP_TYPES[number];

type CityShopOpener = (ctx: CityShopOpenerContext) => Promise<void>;

const SHOP_HANDLERS: Record<CityShopType, CityShopOpener> = {
	royalMarket: openRoyalMarket,
	generalShop: openGeneralShop,
	stockExchange: openStockExchange,
	tanner: openTanner,
	herbalist: openHerbalist,
	lumberjack: openLumberjack,
	veterinarian: openVeterinarian,
	materialMerchant: openMaterialMerchant
};

function isCityShopType(shopId: string): shopId is CityShopType {
	return (CITY_SHOP_TYPES as readonly string[]).includes(shopId);
}

export async function handleCityShopReaction(params: CityShopReactionParams): Promise<void> {
	const {
		player, city, shopId, context, response, onClose
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
	await handler({
		player, city, context, response, onClose
	});

	await MissionsController.update(player, response, { missionId: "visitCityNpc" });
}

/**
 * Per-shop emptiness predicates. A shop is considered empty when it has nothing
 * to offer to the given player — currently only the tanner is dynamic (inventory
 * and plant slot extensions can both be fully bought out); other shops are never
 * empty and therefore have no entry here.
 */
const SHOP_EMPTY_CHECKS: Partial<Record<CityShopType, (player: Player) => Promise<boolean>>> = {
	tanner: async player => {
		const [slotExtension, plantSlotExtension] = await Promise.all([
			getSlotExtensionShopItem(player.id),
			getPlantSlotExtensionShopItem(player.id)
		]);
		return slotExtension === null && plantSlotExtension === null;
	}
};

async function playerHasUnlockedGarden(playerId: number): Promise<boolean> {
	const home = await Homes.getOfPlayer(playerId);
	const homeLevel = home?.getLevel();
	if (!homeLevel) {
		return false;
	}
	return homeLevel.features.gardenPlots > 0;
}

/**
 * Returns true if the given shop has nothing to offer to the player.
 */
export function isCityShopEmpty(player: Player, shopId: string): Promise<boolean> {
	if (!isCityShopType(shopId)) {
		return Promise.resolve(false);
	}
	const check = SHOP_EMPTY_CHECKS[shopId];
	return check ? check(player) : Promise.resolve(false);
}

interface GemShopOptions {
	player: Player;
	context: PacketContext;
	response: CrowniclesPacket[];
	shopCategories: ShopCategory[];
	cityId?: string;
	additionalShopData?: Record<string, unknown>;
	onClose?: OnShopCloseCallback;
}

/**
 * Open a gem-based shop with gemToMoneyRatio in additional data
 */
async function openGemShop({
	player,
	context,
	response,
	shopCategories,
	cityId,
	additionalShopData,
	onClose
}: GemShopOptions): Promise<void> {
	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout.bind(crowniclesInstance?.logsDatabase),
		cityId,
		additionalShopData: {
			gemToMoneyRatio: calculateGemsToMoneyRatio(),
			...additionalShopData
		},
		onClose
	});
}

/**
 * Open the royal market shop for the player (gem exchanges, king's favor and
 * the Maître des quêtes services: mission skip and quest master badge).
 */
export async function openRoyalMarket({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
	const playerMissionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	await openGemShop({
		player,
		context,
		response,
		cityId: city.id,
		onClose,
		shopCategories: [
			{
				id: "resources",
				items: [
					getMoneyShopItem(),
					getValuableItemShopItem()
				]
			},
			{
				id: "services",
				items: [getMissionSkipShopItem(playerMissionsInfo.missionSkipsUsedThisWeek)]
			},
			{
				id: "prestige",
				items: [
					getAThousandPointsShopItem(),
					getQuestMasterBadgeShopItem()
				]
			}
		],
		additionalShopData: { currency: ShopCurrency.GEM }
	});
}

/**
 * Open the general shop for the player (daily potion + random equipment)
 */
export async function openGeneralShop({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
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
		cityId: city.id,
		additionalShopData: {
			remainingPotions,
			dailyPotion: toItemWithDetails(player, potion, 0, null)
		},
		onClose
	});
}

/**
 * Open the stock exchange shop for the player (money mouth badge + gem exchange rate info)
 */
export async function openStockExchange({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
	await openGemShop({
		player,
		context,
		response,
		cityId: city.id,
		onClose,
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
export async function openTanner({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
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
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		cityId: city.id,
		onClose
	});
}

/**
 * Open the herbalist shop for the player (weekly rotating plants + the one-shot
 * "Cœur Sylvestre" talisman that grants remote garden harvest access).
 */
export async function openHerbalist({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
	const weeklyPlants = PlantConstants.getWeeklyHerbalistPlants();
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);

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
				buyCallback: async (buyResponse: CrowniclesPacket[], playerId: number): Promise<BuyCallbackResult> => {
					const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(playerId);
					if (!emptySlot) {
						buyResponse.push(makePacket(CommandShopNoPlantSlotAvailable, {}));
						return { success: false };
					}
					await PlayerPlantSlots.setPlant(playerId, emptySlot.slot, plant.id);
					return { success: true };
				}
			}))
		}
	];

	// One-shot talisman: appears only if the player does not already own it.
	if (!talismans.hasRemoteHarvestTalisman) {
		shopCategories.push({
			id: "remoteHarvestTalisman",
			items: [
				{
					id: ShopItemType.REMOTE_HARVEST_TALISMAN,
					price: GardenConstants.REMOTE_HARVEST_TALISMAN_PRICE,
					amounts: [1],
					buyCallback: async (buyResponse: CrowniclesPacket[], playerId: number): Promise<BuyCallbackResult> => {
						const hasGarden = await playerHasUnlockedGarden(playerId);
						if (!hasGarden) {
							buyResponse.push(makePacket(CommandShopNoGardenForRemoteHarvestTalisman, {}));
							return { success: false };
						}

						const playerTalismans = await PlayerTalismansManager.getOfPlayer(playerId);
						playerTalismans.hasRemoteHarvestTalisman = true;
						await playerTalismans.save();
						await MissionsController.update(player, buyResponse, { missionId: "haveGardenTalisman" });
						return { success: true };
					}
				}
			]
		});
	}

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		cityId: city.id,
		additionalShopData: {
			weeklyPlants: weeklyPlants.map((p: PlantType) => p.id)
		},
		onClose
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
export async function openLumberjack({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
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
				}
			]
		}
	];

	await ShopUtils.createAndSendShopCollector(context, response, {
		shopCategories,
		player,
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		cityId: city.id,
		onClose
	});
}

/**
 * Open the veterinarian shop for the player (pet information + love points boost)
 */
export async function openVeterinarian({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
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
		cityId: city.id,
		additionalShopData: {
			currency: ShopCurrency.GEM
		},
		onClose
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
export async function openMaterialMerchant({
	player, city, context, response, onClose
}: CityShopOpenerContext): Promise<void> {
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
		logger: crowniclesInstance?.logsDatabase.logClassicalShopBuyout.bind(crowniclesInstance?.logsDatabase),
		cityId: city.id,
		onClose
	});
}
