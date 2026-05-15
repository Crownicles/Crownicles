import InventorySlot from "../database/game/models/InventorySlot";
import {
	Player
} from "../database/game/models/Player";
import {
	City
} from "../../data/City";
import {
	Home, Homes
} from "../database/game/models/Home";
import {
	Apartments
} from "../database/game/models/Apartment";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import {
	ChestSlotsPerCategory, HomeFeatures
} from "../../../../Lib/src/types/HomeFeatures";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { ItemRarity, ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import {
	ReactionCollectorCityData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";

import {
	HomeChestSlots
} from "../database/game/models/HomeChestSlot";
import InventoryInfo from "../database/game/models/InventoryInfo";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import { buildGardenData } from "./ReportGardenService";

// Re-exports for backward compatibility
export {
	handleInnMealReaction, handleInnRoomReaction
} from "./ReportCityInnService";
export { handleEnchantReaction } from "./ReportCityEnchanterService";
export {
	handleBuyHomeReaction, handleUpgradeHomeReaction, handleMoveHomeReaction, handleHomeBedReaction
} from "./ReportCityHomeService";
export {
	validateUpgradeItemRequest, handleUpgradeItemReaction, handleBlacksmithUpgradeReaction, handleBlacksmithDisenchantReaction
} from "./ReportCityBlacksmithService";
export type { UpgradeItemValidationResult } from "./ReportCityBlacksmithService";
export { handleCityShopReaction } from "./ReportCityShopService";
export { isCityShopEmpty } from "./ReportCityShopService";
export type { CityShopReactionParams } from "./ReportCityShopService";
export { handleChestAction } from "./ReportCityChestService";

// Type aliases for commonly used nested types from ReactionCollectorCityData
type EnchanterData = NonNullable<ReactionCollectorCityData["enchanter"]>;
type HomeData = ReactionCollectorCityData["home"];
type OwnedHomeData = NonNullable<HomeData["owned"]>;
type UpgradeStationData = NonNullable<OwnedHomeData["upgradeStation"]>;
type ChestData = NonNullable<OwnedHomeData["chest"]>;
type HomesCount = {
	cityId: string;
	count: number;
}[];

/**
 * Build enchanter data for the city reaction collector
 */
export function buildEnchanterData(
	playerData: {
		inventory: InventorySlot[]; player: Player;
	},
	enchantData: {
		enchantment: ItemEnchantment; enchantmentId: string; isPlayerMage: boolean;
	}
): EnchanterData {
	const {
		inventory: playerInventory, player
	} = playerData;
	const {
		enchantment, enchantmentId, isPlayerMage
	} = enchantData;

	const enchantableItems: EnchanterData["enchantableItems"] = [];
	let equipmentCount = 0;
	let hasEnchantedItem = false;

	for (const item of playerInventory) {
		if (item.isPrimaryEquipment()) {
			equipmentCount++;
			if (item.itemEnchantmentId) {
				hasEnchantedItem = true;
			}
			else {
				enchantableItems.push({
					category: item.itemCategory,
					slot: item.slot,
					details: item.itemWithDetails(player) as MainItemDetails
				});
			}
		}
	}

	return {
		enchantableItems,
		isInventoryEmpty: equipmentCount === 0,
		hasAtLeastOneEnchantedItem: hasEnchantedItem,
		enchantmentId,
		enchantmentCost: enchantment.getEnchantmentCost(isPlayerMage),
		enchantmentType: enchantment.kind.type.id,
		mageReduction: isPlayerMage
	};
}

/**
 * Build home data (owned home + manage options) for the city reaction collector
 */
export async function buildHomeData(
	playerData: {
		player: Player; inventory: InventorySlot[]; materialMap: Map<number, number>;
	},
	homeData: {
		home: Home | null; homeLevel: HomeLevel | null;
	},
	city: City
): Promise<HomeData> {
	const {
		player, inventory: playerInventory, materialMap: playerMaterialMap
	} = playerData;
	const {
		home, homeLevel
	} = homeData;
	const isHomeInCity = Boolean(home && home.cityId === city.id && homeLevel);
	const apartment = !isHomeInCity && home && homeLevel
		? await Apartments.getOfPlayerInCity(player.id, city.id)
		: null;
	const isApartmentInCity = Boolean(apartment && home && homeLevel);

	let owned: HomeData["owned"];
	if (isHomeInCity) {
		owned = await buildOwnedHomeData({
			player, playerInventory, playerMaterialMap, home: home!, homeLevel: homeLevel!
		});
	}
	else if (isApartmentInCity) {
		owned = await buildRemoteApartmentHomeData({
			player, playerInventory, home: home!, homeLevel: homeLevel!
		});
	}
	else {
		owned = undefined;
	}

	const manage = await buildManageHomeData({
		player, home, homeLevel, city
	});

	return {
		owned,
		manage
	};
}

async function buildOwnedHomeData(params: {
	player: Player;
	playerInventory: InventorySlot[];
	playerMaterialMap: Map<number, number>;
	home: Home;
	homeLevel: HomeLevel;
}): Promise<HomeData["owned"]> {
	const {
		player, playerInventory, playerMaterialMap, home, homeLevel
	} = params;
	const upgradeStation = buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel, player);
	const chest = await buildChestData(home, homeLevel, playerInventory, player);
	const garden = homeLevel.features.gardenPlots > 0
		? await buildGardenData(home, homeLevel, player)
		: undefined;

	return {
		level: home.level,
		features: homeLevel.features,
		upgradeStation,
		chest,
		garden
	};
}

/**
 * Build owned-home data exposed when the player is in a city where they own an
 * apartment (but not their main home). Provides remote access to the main
 * home's chest and cooking slots, plus a bed regen capped at the apartment
 * lodging level (min of `APARTMENT_BED_LEVEL_CAP` and the home level).
 * Garden and upgrade station are intentionally not exposed remotely.
 */
async function buildRemoteApartmentHomeData(params: {
	player: Player;
	playerInventory: InventorySlot[];
	home: Home;
	homeLevel: HomeLevel;
}): Promise<HomeData["owned"]> {
	const {
		player, playerInventory, home, homeLevel
	} = params;
	const cappedBedLevel = Math.min(HomeConstants.APARTMENT_BED_LEVEL_CAP, home.level);
	const cappedHomeLevel = HomeLevel.getByLevel(cappedBedLevel) ?? homeLevel;
	const remoteFeatures: HomeFeatures = {
		...homeLevel.features,
		bedHealthRegeneration: cappedHomeLevel.features.bedHealthRegeneration,
		gardenPlots: 0,
		upgradeItemMaximumRarity: ItemRarity.BASIC,
		maxItemUpgradeLevel: 0
	};
	const chest = await buildChestData(home, homeLevel, playerInventory, player);

	return {
		level: home.level,
		features: remoteFeatures,
		upgradeStation: undefined,
		chest,
		garden: undefined
	};
}

async function buildManageHomeData(params: {
	player: Player;
	home: Home | null;
	homeLevel: HomeLevel | null;
	city: City;
}): Promise<HomeData["manage"]> {
	const {
		player, home, homeLevel, city
	} = params;
	const isHomeInCity = Boolean(home && home.cityId === city.id && homeLevel);
	const homesCount = await Homes.getHomesCount();

	const manageOptions = buildManageOptions({
		home, homeLevel, city, player, isHomeInCity, homesCount
	});
	if (manageOptions) {
		return {
			...manageOptions,
			currentMoney: player.money
		};
	}

	return homeLevel ? buildNoOptionsReason(isHomeInCity, homeLevel, player) : undefined;
}

interface ManageOptions {
	newPrice?: number;
	upgrade?: {
		price: number;
		oldFeatures: HomeLevel["features"];
		newFeatures: HomeLevel["features"];
	};
	movePrice?: number;
}

interface ExistingHomeManageParams {
	home: Home;
	homeLevel: HomeLevel;
	city: City;
	player: Player;
	isHomeInCity: boolean;
	homesCount: HomesCount;
}

function getUpgradeOption(params: ExistingHomeManageParams): ManageOptions["upgrade"] {
	const {
		homeLevel, player, isHomeInCity, city
	} = params;
	const nextHomeUpgrade = HomeLevel.getNextUpgrade(homeLevel, player.level);
	if (!nextHomeUpgrade || !isHomeInCity) {
		return undefined;
	}
	return {
		price: city.getHomeLevelPrice(nextHomeUpgrade),
		oldFeatures: homeLevel.features,
		newFeatures: nextHomeUpgrade.features
	};
}

function getMovePrice(params: ExistingHomeManageParams): number | undefined {
	const {
		home, city, homesCount
	} = params;
	if (home.cityId === city.id) {
		return undefined;
	}
	return city.getMovePrice(homesCount);
}

function buildExistingHomeOptions(params: ExistingHomeManageParams): ManageOptions | undefined {
	const upgrade = getUpgradeOption(params);
	const movePrice = getMovePrice(params);

	if (!upgrade && !movePrice) {
		return undefined;
	}
	return {
		upgrade,
		movePrice
	};
}

function buildManageOptions(params: {
	home: Home | null;
	homeLevel: HomeLevel | null;
	city: City;
	player: Player;
	isHomeInCity: boolean;
	homesCount: HomesCount;
}): ManageOptions | undefined {
	const {
		home, homeLevel, city, player, isHomeInCity, homesCount
	} = params;

	if (!home) {
		return { newPrice: city.getHomeLevelPrice(HomeLevel.getInitialLevel()) };
	}

	if (!homeLevel) {
		return undefined;
	}

	return buildExistingHomeOptions({
		home, homeLevel, city, player, isHomeInCity, homesCount
	});
}

function buildNoOptionsReason(
	isHomeInCity: boolean,
	homeLevel: HomeLevel,
	player: Player
): HomeData["manage"] {
	if (!isHomeInCity) {
		return undefined;
	}

	const nextLevel = HomeLevel.getNextLevelInfo(homeLevel);
	return {
		currentMoney: player.money,
		isMaxLevel: nextLevel === null,
		requiredPlayerLevelForUpgrade: nextLevel && player.level < nextLevel.requiredPlayerLevel
			? nextLevel.requiredPlayerLevel
			: undefined
	};
}

/**
 * Build upgrade station data for the home feature in the city collector.
 * Determines which items can be upgraded at home and their material requirements.
 */
export function buildUpgradeStationData(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	homeLevel: HomeLevel,
	player: Player
): UpgradeStationData {
	const maxUpgradeableRarity = homeLevel.features.upgradeItemMaximumRarity;
	const maxLevelAtHome = homeLevel.features.maxItemUpgradeLevel;

	const upgradeableItems: UpgradeStationData["upgradeableItems"] = [];

	for (const inventorySlot of playerInventory) {
		// Only process weapons and armors with a valid item
		if (!inventorySlot.isPrimaryEquipment()) {
			continue;
		}

		// Get the item data
		const itemData = inventorySlot.isWeapon()
			? WeaponDataController.instance.getById(inventorySlot.itemId)
			: ArmorDataController.instance.getById(inventorySlot.itemId);

		if (!itemData) {
			continue;
		}

		// Check if item level allows upgrade at home (limited by home's maxItemUpgradeLevel)
		const currentLevel = inventorySlot.itemLevel ?? 0;
		if (currentLevel >= maxLevelAtHome) {
			continue;
		}

		// Check if item rarity is allowed at this home level
		if (itemData.rarity > maxUpgradeableRarity) {
			continue;
		}

		const nextLevel = currentLevel + 1;
		const requiredMaterialsRaw = itemData.getUpgradeMaterials(nextLevel);

		// Aggregate materials (same material can appear multiple times)
		const materialAggregation = new Map<number, number>();
		for (const material of requiredMaterialsRaw) {
			const materialIdNum = parseInt(material.id, 10);
			materialAggregation.set(materialIdNum, (materialAggregation.get(materialIdNum) ?? 0) + 1);
		}

		const requiredMaterials: typeof upgradeableItems[number]["requiredMaterials"] = [];
		let canUpgrade = true;

		for (const [materialId, quantity] of materialAggregation) {
			const playerQuantity = playerMaterialMap.get(materialId) ?? 0;
			requiredMaterials.push({
				materialId,
				quantity,
				playerQuantity
			});
			if (playerQuantity < quantity) {
				canUpgrade = false;
			}
		}

		upgradeableItems.push({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player) as MainItemDetails,
			nextLevel,
			requiredMaterials,
			canUpgrade
		});
	}

	return {
		upgradeableItems,
		maxUpgradeableRarity
	};
}

/**
 * Build chest data for the home feature in the city collector.
 * Loads items currently stored in the chest and items that can be deposited from the player's inventory.
 */
export async function buildChestData(
	home: Home,
	homeLevel: HomeLevel,
	playerInventory: InventorySlot[],
	player: Player
): Promise<ChestData> {
	const slotsPerCategory = homeLevel.features.chestSlots;

	// Ensure chest slots exist for the current home level
	await HomeChestSlots.ensureSlotsForLevel(home.id, slotsPerCategory);

	// Load all chest slots
	const allChestSlots = await HomeChestSlots.getOfHome(home.id);

	// Build chest items (non-empty slots)
	const chestItems: ChestData["chestItems"] = allChestSlots
		.filter(slot => slot.itemId !== 0)
		.map(slot => ({
			slot: slot.slot,
			category: slot.itemCategory,
			details: slot.itemWithDetails(player)
		}));

	// Build depositable items (all inventory items with itemId !== 0, including active items)
	const depositableItems: ChestData["depositableItems"] = playerInventory
		.filter(inventorySlot => inventorySlot.itemId !== 0)
		.map(inventorySlot => ({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player)
		}));

	// Get inventory capacity per category (max backup slots) including home bonus
	const inventoryInfo = await InventoryInfo.findOne({ where: { playerId: player.id } });
	const homeBonus = homeLevel.features.inventoryBonus;
	const inventoryCapacity: ChestSlotsPerCategory = {
		weapon: (inventoryInfo ? inventoryInfo.slotLimitForCategory(ItemCategory.WEAPON) : 1) + homeBonus.weapon,
		armor: (inventoryInfo ? inventoryInfo.slotLimitForCategory(ItemCategory.ARMOR) : 1) + homeBonus.armor,
		potion: (inventoryInfo ? inventoryInfo.slotLimitForCategory(ItemCategory.POTION) : 1) + homeBonus.potion,
		object: (inventoryInfo ? inventoryInfo.slotLimitForCategory(ItemCategory.OBJECT) : 1) + homeBonus.object
	};

	// Build plant data if garden is available
	const hasGarden = homeLevel.features.gardenPlots > 0;
	let plantStorage: ChestData["plantStorage"];
	let playerPlantSlots: ChestData["playerPlantSlots"];
	let plantMaxCapacity: ChestData["plantMaxCapacity"];

	if (hasGarden) {
		const homeStorage = await HomePlantStorages.getOfHome(home.id);

		// Ensure player plant slots are initialized before reading them
		const desiredPlantSlots = inventoryInfo ? inventoryInfo.plantSlots : 1;
		await PlayerPlantSlots.ensureSlotsForCount(player.id, desiredPlantSlots);

		const plantSlots = await PlayerPlantSlots.getPlantSlots(player.id);
		plantMaxCapacity = home.level;

		plantStorage = homeStorage
			.filter(s => s.quantity > 0)
			.map(s => ({
				plantId: s.plantId,
				quantity: s.quantity,
				maxCapacity: plantMaxCapacity!
			}));

		playerPlantSlots = plantSlots.map(s => ({
			slot: s.slot,
			plantId: s.plantId
		}));
	}

	return {
		chestItems,
		depositableItems,
		slotsPerCategory,
		inventoryCapacity,
		plantStorage,
		playerPlantSlots,
		plantMaxCapacity
	};
}

