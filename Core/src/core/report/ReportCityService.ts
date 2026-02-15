import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	City
} from "../../data/City";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import {
	ChestSlotsPerCategory, EMPTY_SLOTS_PER_CATEGORY, getSlotCountForCategory
} from "../../../../Lib/src/types/HomeFeatures";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import {
	ReactionCollectorCityData,
	ReactionCollectorEnchantReaction,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction,
	ReactionCollectorUpgradeItemReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorBlacksmithDisenchantReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import {
	BlacksmithConstants, ItemLevel, ItemUpgradeLevel
} from "../../../../Lib/src/constants/BlacksmithConstants";
import {
	getDisenchantPrice, getMaterialsPurchasePrice, getUpgradePrice
} from "../../../../Lib/src/utils/BlacksmithUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBlacksmithDisenchantRes,
	CommandReportBlacksmithMissingMaterialsRes,
	CommandReportBlacksmithNotEnoughMoneyRes,
	CommandReportBlacksmithUpgradeRes,
	CommandReportBuyHomeRes,
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportHomeChestActionReq,
	CommandReportHomeChestActionRes,
	CommandReportHomeBedAlreadyFullRes,
	CommandReportHomeBedRes,
	CommandReportItemCannotBeEnchantedRes,
	CommandReportItemEnchantedRes,
	CommandReportMoveHomeRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportSleepRoomRes,
	CommandReportUpgradeHomeRes,
	CommandReportUpgradeItemMaxLevelRes,
	CommandReportUpgradeItemMissingMaterialsRes,
	CommandReportUpgradeItemRes,
	ChestError,
	CommandReportGardenHarvestReq,
	CommandReportGardenHarvestRes,
	CommandReportGardenPlantReq,
	CommandReportGardenPlantRes,
	CommandReportGardenPlantErrorRes,
	CommandReportPlantTransferReq,
	CommandReportPlantTransferRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	HomeChestSlot, HomeChestSlots
} from "../database/game/models/HomeChestSlot";
import InventoryInfo from "../database/game/models/InventoryInfo";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Settings } from "../database/game/models/Setting";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { Materials } from "../database/game/models/Material";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { ShopUtils } from "../utils/ShopUtils";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { ShopCategory } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
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
import { getBadgeShopItem } from "../utils/StockExchangeShopItems";
import {
	getPlantSlotExtensionShopItem, getSlotExtensionShopItem
} from "../utils/TannerShopItems";
import { crowniclesInstance } from "../../index";
import { toItemWithDetails } from "../utils/ItemUtils";
import {
	HomeGardenSlot, HomeGardenSlots
} from "../database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

// Type aliases for commonly used nested types from ReactionCollectorCityData
type EnchanterData = NonNullable<ReactionCollectorCityData["enchanter"]>;
type HomeData = ReactionCollectorCityData["home"];
type UpgradeStationData = NonNullable<NonNullable<HomeData["owned"]>["upgradeStation"]>;
type ChestData = NonNullable<NonNullable<HomeData["owned"]>["chest"]>;
type BlacksmithData = NonNullable<ReactionCollectorCityData["blacksmith"]>;
type GardenData = NonNullable<NonNullable<HomeData["owned"]>["garden"]>;
type ChestActionResult = Omit<CommandReportHomeChestActionRes, "name">;

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
	const nextHomeUpgrade = homeLevel ? HomeLevel.getNextUpgrade(homeLevel, player.level) : null;

	let upgradeStation;
	let chest;
	let garden;
	let owned;
	if (isHomeInCity) {
		upgradeStation = buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel!, player);
		chest = await buildChestData(home!, homeLevel!, playerInventory, player);
		garden = homeLevel!.features.gardenPlots > 0
			? await buildGardenData(home!, homeLevel!, player)
			: undefined;
		owned = {
			level: home!.level,
			features: homeLevel!.features,
			upgradeStation,
			chest,
			garden
		};
	}

	const homesCount = await Homes.getHomesCount();

	const manage: HomeData["manage"] = {
		newPrice: home ? undefined : city.getHomeLevelPrice(HomeLevel.getInitialLevel(), homesCount),
		upgrade: nextHomeUpgrade && isHomeInCity
			? {
				price: city.getHomeLevelPrice(nextHomeUpgrade, homesCount),
				oldFeatures: homeLevel!.features,
				newFeatures: nextHomeUpgrade.features
			}
			: undefined,
		movePrice: home && home.cityId !== city.id && homeLevel
			? city.getHomeLevelPrice(homeLevel, homesCount)
			: undefined,
		currentMoney: player.money
	};

	const hasManageOptions = manage.newPrice || manage.upgrade || manage.movePrice;

	return {
		owned,
		manage: hasManageOptions ? manage : undefined
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
		const plantSlots = await PlayerPlantSlots.getPlantSlots(player.id);
		plantMaxCapacity = home.level;

		plantStorage = homeStorage
			.filter(s => s.quantity > 0)
			.map(s => ({
				plantId: s.plantId as PlantId,
				quantity: s.quantity,
				maxCapacity: plantMaxCapacity!
			}));

		playerPlantSlots = plantSlots.map(s => ({
			slot: s.slot,
			plantId: s.plantId as PlantId | 0
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

/**
 * Get the item data (weapon or armor) for an inventory slot
 */
function getBlacksmithItemData(inventorySlot: InventorySlot): ReturnType<typeof WeaponDataController.instance.getById> | ReturnType<typeof ArmorDataController.instance.getById> | null {
	if (!inventorySlot.isPrimaryEquipment()) {
		return null;
	}
	return inventorySlot.isWeapon()
		? WeaponDataController.instance.getById(inventorySlot.itemId)
		: ArmorDataController.instance.getById(inventorySlot.itemId);
}

/**
 * Build the list of items that can be upgraded at the blacksmith
 */
function buildBlacksmithUpgradeableItems(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	player: Player
): BlacksmithData["upgradeableItems"] {
	const upgradeableItems: BlacksmithData["upgradeableItems"] = [];

	for (const inventorySlot of playerInventory) {
		const itemData = getBlacksmithItemData(inventorySlot);
		if (!itemData) {
			continue;
		}

		const currentLevel = inventorySlot.itemLevel ?? 0;
		if (currentLevel >= BlacksmithConstants.MAX_UPGRADE_LEVEL) {
			continue;
		}

		const nextLevel = currentLevel + 1 as ItemUpgradeLevel;
		const requiredMaterialsRaw = itemData.getUpgradeMaterials(nextLevel);

		// Aggregate materials with rarity info
		const materialAggregation = new Map<number, {
			quantity: number; rarity: number;
		}>();
		for (const material of requiredMaterialsRaw) {
			const materialIdNum = parseInt(material.id, 10);
			const existing = materialAggregation.get(materialIdNum);
			if (existing) {
				existing.quantity += 1;
			}
			else {
				materialAggregation.set(materialIdNum, {
					quantity: 1,
					rarity: material.rarity
				});
			}
		}

		const requiredMaterials: typeof upgradeableItems[number]["requiredMaterials"] = [];
		const missingMaterials: {
			rarity: number; quantity: number;
		}[] = [];
		let hasAllMaterials = true;

		for (const [
			materialId, {
				quantity, rarity
			}
		] of materialAggregation) {
			const playerQuantity = playerMaterialMap.get(materialId) ?? 0;
			requiredMaterials.push({
				materialId,
				rarity,
				quantity,
				playerQuantity
			});
			if (playerQuantity < quantity) {
				hasAllMaterials = false;
				missingMaterials.push({
					rarity,
					quantity: quantity - playerQuantity
				});
			}
		}

		const upgradeCost = getUpgradePrice(nextLevel, itemData.rarity);
		const missingMaterialsCost = getMaterialsPurchasePrice(missingMaterials);

		upgradeableItems.push({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player) as MainItemDetails,
			nextLevel,
			upgradeCost,
			requiredMaterials,
			missingMaterialsCost,
			hasAllMaterials
		});
	}

	return upgradeableItems;
}

/**
 * Build the list of items that can be disenchanted at the blacksmith
 */
function buildBlacksmithDisenchantableItems(
	playerInventory: InventorySlot[],
	player: Player
): BlacksmithData["disenchantableItems"] {
	const disenchantableItems: BlacksmithData["disenchantableItems"] = [];

	for (const inventorySlot of playerInventory) {
		const itemData = getBlacksmithItemData(inventorySlot);
		if (!itemData || !inventorySlot.itemEnchantmentId) {
			continue;
		}

		const enchantment = ItemEnchantment.getById(inventorySlot.itemEnchantmentId);
		if (enchantment) {
			disenchantableItems.push({
				slot: inventorySlot.slot,
				category: inventorySlot.itemCategory,
				details: inventorySlot.itemWithDetails(player) as MainItemDetails,
				enchantmentId: inventorySlot.itemEnchantmentId,
				enchantmentType: enchantment.kind.type.id,
				disenchantCost: getDisenchantPrice(itemData.rarity)
			});
		}
	}

	return disenchantableItems;
}

/**
 * Build blacksmith data for the city collector.
 * The blacksmith allows upgrading items beyond home level and disenchanting items.
 */
export function buildBlacksmithData(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	player: Player
): BlacksmithData {
	return {
		upgradeableItems: buildBlacksmithUpgradeableItems(playerInventory, playerMaterialMap, player),
		disenchantableItems: buildBlacksmithDisenchantableItems(playerInventory, player),
		playerMoney: player.money
	};
}

/**
 * Handle inn meal reaction — player eats a meal at an inn
 */
export async function handleInnMealReaction(
	player: Player,
	reaction: ReactionCollectorInnMealReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (player.canEat()) {
		if (reaction.meal.price > player.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.meal.price - player.money }));
			return;
		}

		player.addEnergy(reaction.meal.energy, NumberChangeReason.INN_MEAL, await InventorySlots.getPlayerActiveObjects(player.id));
		player.eatMeal();
		await player.spendMoney({
			response,
			amount: reaction.meal.price,
			reason: NumberChangeReason.INN_MEAL
		});
		await player.save();
		response.push(makePacket(CommandReportEatInnMealRes, {
			energy: reaction.meal.energy,
			moneySpent: reaction.meal.price
		}));
	}
	else {
		response.push(makePacket(CommandReportEatInnMealCooldownRes, {}));
	}
}

/**
 * Handle inn room reaction — player rents a room at an inn
 */
export async function handleInnRoomReaction(
	player: Player,
	reaction: ReactionCollectorInnRoomReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (reaction.room.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.room.price - player.money }));
		return;
	}

	await player.addHealth({
		amount: reaction.room.health,
		response,
		reason: NumberChangeReason.INN_ROOM,
		playerActiveObjects: await InventorySlots.getPlayerActiveObjects(player.id)
	});
	await player.spendMoney({
		response,
		amount: reaction.room.price,
		reason: NumberChangeReason.INN_ROOM
	});
	await TravelTime.applyEffect(player, Effect.SLEEPING, 0, new Date(), NumberChangeReason.INN_ROOM);
	await player.save();
	response.push(makePacket(CommandReportSleepRoomRes, {
		roomId: reaction.room.roomId,
		health: reaction.room.health,
		moneySpent: reaction.room.price
	}));
}

/**
 * Check if the enchantment conditions are met (enough currencies, valid item)
 */
async function checkEnchantmentConditions(
	player: Player,
	reaction: ReactionCollectorEnchantReaction,
	response: CrowniclesPacket[]
): Promise<{
	enchantment: ItemEnchantment;
	price: {
		money: number; gems: number;
	};
	playerMissionsInfo: PlayerMissionsInfo | null;
	itemToEnchant: InventorySlot;
} | null> {
	const enchantment = ItemEnchantment.getById(await Settings.ENCHANTER_ENCHANTMENT_ID.getValue());
	if (!enchantment) {
		CrowniclesLogger.error("No enchantment found for enchanter. Check ENCHANTER_ENCHANTMENT_ID setting.");
		return null;
	}
	const isPlayerMage = player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
	const price = enchantment.getEnchantmentCost(isPlayerMage);

	const hasEnoughMoney = player.money >= price.money;
	const playerMissionsInfo = price.gems !== 0 ? await PlayerMissionsInfos.getOfPlayer(player.id) : null;
	const hasEnoughGems = playerMissionsInfo ? playerMissionsInfo.gems >= price.gems : true;

	if (!hasEnoughMoney || !hasEnoughGems) {
		response.push(makePacket(CommandReportEnchantNotEnoughCurrenciesRes, {
			missingMoney: hasEnoughMoney ? 0 : price.money - player.money,
			missingGems: hasEnoughGems ? 0 : price.gems - (playerMissionsInfo?.gems ?? 0)
		}));
		return null;
	}

	const itemToEnchant = await InventorySlots.getItem(player.id, reaction.slot, reaction.itemCategory);
	if (!itemToEnchant || !itemToEnchant.isWeaponOrArmor() || itemToEnchant.itemEnchantmentId) {
		CrowniclesLogger.error("Player tried to enchant an item that doesn't exist or cannot be enchanted. It shouldn't happen because the player must not be able to switch items while in the collector.");
		response.push(makePacket(CommandReportItemCannotBeEnchantedRes, {}));
		return null;
	}

	return {
		enchantment, price, playerMissionsInfo, itemToEnchant
	};
}

/**
 * Parameters for the enchantItem function
 */
interface EnchantItemParams {
	player: Player;
	enchantment: ItemEnchantment;
	price: {
		money: number; gems: number;
	};
	playerMissionsInfo: PlayerMissionsInfo | null;
	itemToEnchant: InventorySlot;
	response: CrowniclesPacket[];
}

/**
 * Apply the enchantment to the item and spend currencies
 */
async function enchantItem(params: EnchantItemParams): Promise<void> {
	const {
		player, enchantment, price, playerMissionsInfo, itemToEnchant, response
	} = params;
	await player.reload();

	itemToEnchant.itemEnchantmentId = enchantment.id;
	if (price.money > 0) {
		await player.spendMoney({
			response,
			amount: price.money,
			reason: NumberChangeReason.ENCHANT_ITEM
		});
	}
	if (price.gems > 0 && playerMissionsInfo) {
		await playerMissionsInfo.spendGems(price.gems, response, NumberChangeReason.ENCHANT_ITEM);
	}

	await Promise.all([
		itemToEnchant.save(),
		player.save(),
		playerMissionsInfo ? playerMissionsInfo.save() : Promise.resolve()
	]);

	response.push(makePacket(CommandReportItemEnchantedRes, {
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id
	}));
}

/**
 * Handle enchant reaction — player enchants an item at the enchanter
 */
export async function handleEnchantReaction(player: Player, reaction: ReactionCollectorEnchantReaction, response: CrowniclesPacket[]): Promise<void> {
	const conditions = await checkEnchantmentConditions(player, reaction, response);
	if (!conditions) {
		return;
	}

	await enchantItem({
		player,
		enchantment: conditions.enchantment,
		price: conditions.price,
		playerMissionsInfo: conditions.playerMissionsInfo,
		itemToEnchant: conditions.itemToEnchant,
		response
	});
}

/**
 * Handle buy home reaction — player purchases a new home in the city
 */
export async function handleBuyHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.newPrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to buy a home in city ${city.id} but no home is available to buy. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}
	if (data.home.manage.newPrice > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.newPrice - player.money }));
		return;
	}

	await Promise.all([
		player.spendMoney({
			response,
			amount: data.home.manage.newPrice,
			reason: NumberChangeReason.BUY_HOME
		}),
		Homes.createOrUpdateHome(player.id, city.id, HomeLevel.getInitialLevel().level)
	]);

	await player.save();

	response.push(makePacket(CommandReportBuyHomeRes, {
		cost: data.home.manage.newPrice
	}));
}

/**
 * Handle upgrade home reaction — player upgrades their home level
 */
export async function handleUpgradeHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.upgrade) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade a home in city ${city.id} but no upgrade is available. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	if (data.home.manage.upgrade.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.upgrade.price - player.money }));
		return;
	}

	const home = await Homes.getOfPlayer(player.id);

	if (!home || home.cityId !== city.id) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade a home he doesn't own in city ${city.id}. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	const oldLevel = home.getLevel()!;
	const newLevel = HomeLevel.getNextUpgrade(oldLevel, player.level)!;
	home.level = newLevel.level;

	/*
	 * Note: inventory bonus is now calculated dynamically based on home level,
	 * so we no longer modify InventoryInfo during upgrades
	 */

	await player.spendMoney({
		response,
		amount: data.home.manage.upgrade.price,
		reason: NumberChangeReason.UPGRADE_HOME
	});

	await Promise.all([
		home.save(),
		player.save()
	]);

	response.push(makePacket(CommandReportUpgradeHomeRes, {
		cost: data.home.manage.upgrade.price
	}));
}

/**
 * Handle move home reaction — player moves their home to a different city
 */
export async function handleMoveHomeReaction(player: Player, city: City, data: ReactionCollectorCityData, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	if (!data.home.manage?.movePrice) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home to city ${city.id} but no home is available to move. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	if (data.home.manage.movePrice > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: data.home.manage.movePrice - player.money }));
		return;
	}

	const home = await Homes.getOfPlayer(player.id);

	if (!home) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to move a home he doesn't own. It shouldn't happen because the player must not be able to switch while in the collector.`);
		return;
	}

	home.cityId = city.id;

	await player.spendMoney({
		response,
		amount: data.home.manage.movePrice,
		reason: NumberChangeReason.MOVE_HOME
	});

	await Promise.all([
		home.save(),
		player.save()
	]);

	response.push(makePacket(CommandReportMoveHomeRes, {
		cost: data.home.manage.movePrice
	}));
}

export interface UpgradeItemValidationResult {
	itemToUpgrade?: {
		nextLevel: number;
		canUpgrade: boolean;
		requiredMaterials: MaterialQuantity[];
		slot: number;
		category: number;
	};
	error?: CrowniclesPacket;
	logError?: string;
}

/**
 * Validate an upgrade item request from the upgrade station
 */
export function validateUpgradeItemRequest(
	player: Player,
	reaction: ReactionCollectorUpgradeItemReaction,
	data: ReactionCollectorCityData
): UpgradeItemValidationResult {
	const upgradeStation = data.home.owned?.upgradeStation;
	if (!upgradeStation) {
		return { logError: `Player ${player.keycloakId} tried to upgrade an item but no upgrade station data available.` };
	}

	const itemToUpgrade = upgradeStation.upgradeableItems.find(
		item => item.slot === reaction.slot && item.category === reaction.itemCategory
	);

	if (!itemToUpgrade) {
		return { logError: `Player ${player.keycloakId} tried to upgrade an item that doesn't exist in the upgrade station.` };
	}

	const maxLevelAtHome = data.home.owned?.features.maxItemUpgradeLevel ?? 1;
	if (itemToUpgrade.nextLevel > maxLevelAtHome) {
		return { error: makePacket(CommandReportUpgradeItemMaxLevelRes, {}) };
	}

	if (!itemToUpgrade.canUpgrade) {
		return { error: makePacket(CommandReportUpgradeItemMissingMaterialsRes, {}) };
	}

	return { itemToUpgrade };
}

/**
 * Handle upgrade item reaction — player upgrades an item at the home upgrade station
 */
export async function handleUpgradeItemReaction(
	player: Player,
	reaction: ReactionCollectorUpgradeItemReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const validation = validateUpgradeItemRequest(player, reaction, data);

	if (validation.logError) {
		CrowniclesLogger.error(validation.logError);
		return;
	}
	if (validation.error) {
		response.push(validation.error);
		return;
	}

	const { itemToUpgrade } = validation;

	// Consume materials
	const materialsToConsume = itemToUpgrade!.requiredMaterials.map(m => ({
		materialId: m.materialId,
		quantity: m.quantity
	}));

	const consumed = await Materials.consumeMaterials(player.id, materialsToConsume);
	if (!consumed) {
		response.push(makePacket(CommandReportUpgradeItemMissingMaterialsRes, {}));
		return;
	}

	// Upgrade the item
	const inventorySlot = await InventorySlots.getOfPlayer(player.id)
		.then(slots => slots.find(s => s.slot === reaction.slot && s.itemCategory === reaction.itemCategory));

	if (!inventorySlot) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade an item that doesn't exist in their inventory.`);
		return;
	}

	inventorySlot.itemLevel = itemToUpgrade!.nextLevel;
	await inventorySlot.save();

	response.push(makePacket(CommandReportUpgradeItemRes, {
		itemCategory: reaction.itemCategory,
		newItemLevel: itemToUpgrade!.nextLevel
	}));
}

/**
 * Handle blacksmith upgrade reaction — player upgrades an item at the blacksmith
 */
export async function handleBlacksmithUpgradeReaction(
	player: Player,
	reaction: ReactionCollectorBlacksmithUpgradeReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const blacksmith = data.blacksmith;
	if (!blacksmith) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use blacksmith but no blacksmith data available.`);
		return;
	}

	const itemToUpgrade = blacksmith.upgradeableItems.find(
		item => item.slot === reaction.slot && item.category === reaction.itemCategory
	);

	if (!itemToUpgrade) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade an item that doesn't exist in the blacksmith.`);
		return;
	}

	// Re-fetch material quantities from DB to avoid relying on stale collector snapshot
	const playerMaterials = await Materials.getPlayerMaterials(player.id);
	const playerMaterialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));

	const freshHasAllMaterials = itemToUpgrade.requiredMaterials.every(
		m => (playerMaterialMap.get(m.materialId) ?? 0) >= m.quantity
	);

	// Calculate fresh missing materials cost based on DB state
	const freshMissingMaterials = itemToUpgrade.requiredMaterials
		.filter(m => (playerMaterialMap.get(m.materialId) ?? 0) < m.quantity)
		.map(m => ({
			rarity: m.rarity,
			quantity: m.quantity - (playerMaterialMap.get(m.materialId) ?? 0)
		}));
	const freshMissingMaterialsCost = getMaterialsPurchasePrice(freshMissingMaterials);

	// Calculate total cost using fresh data
	let totalCost = itemToUpgrade.upgradeCost;
	const boughtMaterials = reaction.buyMaterials && !freshHasAllMaterials;

	if (boughtMaterials) {
		totalCost += freshMissingMaterialsCost;
	}

	// Check if player has enough money
	if (player.money < totalCost) {
		response.push(makePacket(CommandReportBlacksmithNotEnoughMoneyRes, {
			missingMoney: totalCost - player.money
		}));
		return;
	}

	// If not buying materials, check if player still has all required materials
	if (!boughtMaterials && !freshHasAllMaterials) {
		response.push(makePacket(CommandReportBlacksmithMissingMaterialsRes, {}));
		return;
	}

	// Consume materials: consume full quantities required (at this point we know player has them or is buying them)
	const materialsToConsume = itemToUpgrade.requiredMaterials
		.map(m => ({
			materialId: m.materialId,
			quantity: Math.min(m.quantity, playerMaterialMap.get(m.materialId) ?? 0)
		}))
		.filter(m => m.quantity > 0);

	if (materialsToConsume.length > 0) {
		const consumed = await Materials.consumeMaterials(player.id, materialsToConsume);
		if (!consumed) {
			response.push(makePacket(CommandReportBlacksmithMissingMaterialsRes, {}));
			return;
		}
	}

	// Spend money
	await player.spendMoney({
		response,
		amount: totalCost,
		reason: NumberChangeReason.BLACKSMITH_UPGRADE
	});

	// Upgrade the item
	const inventorySlot = await InventorySlots.getOfPlayer(player.id)
		.then(slots => slots.find(s => s.slot === reaction.slot && s.itemCategory === reaction.itemCategory));

	if (!inventorySlot) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade an item that doesn't exist in their inventory.`);
		return;
	}

	inventorySlot.itemLevel = itemToUpgrade.nextLevel;
	await inventorySlot.save();
	await player.save();

	response.push(makePacket(CommandReportBlacksmithUpgradeRes, {
		itemCategory: reaction.itemCategory,
		newItemLevel: itemToUpgrade.nextLevel,
		totalCost,
		boughtMaterials
	}));
}

/**
 * Handle blacksmith disenchant reaction — player removes an enchantment at the blacksmith
 */
export async function handleBlacksmithDisenchantReaction(
	player: Player,
	reaction: ReactionCollectorBlacksmithDisenchantReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const blacksmith = data.blacksmith;
	if (!blacksmith) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use blacksmith but no blacksmith data available.`);
		return;
	}

	const itemToDisenchant = blacksmith.disenchantableItems.find(
		item => item.slot === reaction.slot && item.category === reaction.itemCategory
	);

	if (!itemToDisenchant) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to disenchant an item that doesn't exist in the blacksmith.`);
		return;
	}

	// Check if player has enough money
	if (player.money < itemToDisenchant.disenchantCost) {
		response.push(makePacket(CommandReportBlacksmithNotEnoughMoneyRes, {
			missingMoney: itemToDisenchant.disenchantCost - player.money
		}));
		return;
	}

	// Spend money
	await player.spendMoney({
		response,
		amount: itemToDisenchant.disenchantCost,
		reason: NumberChangeReason.BLACKSMITH_DISENCHANT
	});

	// Remove enchantment from the item
	const inventorySlot = await InventorySlots.getOfPlayer(player.id)
		.then(slots => slots.find(s => s.slot === reaction.slot && s.itemCategory === reaction.itemCategory));

	if (!inventorySlot) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to disenchant an item that doesn't exist in their inventory.`);
		return;
	}

	inventorySlot.itemEnchantmentId = null;
	await inventorySlot.save();
	await player.save();

	response.push(makePacket(CommandReportBlacksmithDisenchantRes, {
		itemCategory: reaction.itemCategory,
		cost: itemToDisenchant.disenchantCost
	}));
}

/**
 * Handle city shop reaction — player visits a shop in the city
 */
/**
 * Parameters for handleCityShopReaction
 */
interface CityShopReactionParams {
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
 * Handle home bed reaction — player rests in their home bed to recover health
 */
export async function handleHomeBedReaction(
	player: Player,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const homeData = data.home.owned;
	if (!homeData) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use home bed without owning a home.`);
		return;
	}

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const maxHealth = player.getMaxHealth(playerActiveObjects);
	if (player.getHealth(playerActiveObjects) >= maxHealth) {
		response.push(makePacket(CommandReportHomeBedAlreadyFullRes, {}));
		return;
	}

	await player.addHealth({
		amount: homeData.features.bedHealthRegeneration,
		response,
		reason: NumberChangeReason.HOME_BED,
		playerActiveObjects
	});
	await TravelTime.applyEffect(player, Effect.SLEEPING, 0, new Date(), NumberChangeReason.HOME_BED);
	await player.save();
	response.push(makePacket(CommandReportHomeBedRes, {
		health: homeData.features.bedHealthRegeneration
	}));
}

function buildChestActionError(error: ChestError): ChestActionResult {
	return {
		success: false,
		error,
		chestItems: [],
		depositableItems: [],
		slotsPerCategory: EMPTY_SLOTS_PER_CATEGORY,
		inventoryCapacity: EMPTY_SLOTS_PER_CATEGORY
	};
}

const INVALID_CHEST_ACTION = buildChestActionError(HomeConstants.CHEST_ERRORS.INVALID);

/**
 * Handle a chest action request (deposit/withdraw) sent directly from Discord via AsyncPacketSender.
 * Returns refreshed chest data for the Discord side to update the view in-place.
 */
export async function handleChestAction(
	keycloakId: string,
	packet: CommandReportHomeChestActionReq
): Promise<ChestActionResult> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const homeLevel = home?.getLevel();

	if (!player || !home || !homeLevel) {
		return INVALID_CHEST_ACTION;
	}

	const error = await executeChestAction(packet, player, home);
	if (error) {
		return buildChestActionError(error);
	}

	// Build refreshed chest data
	const playerInventory = await InventorySlots.getOfPlayer(player.id);
	const refreshedData = await buildChestData(home, homeLevel, playerInventory, player);

	return {
		success: true,
		chestItems: refreshedData.chestItems,
		depositableItems: refreshedData.depositableItems,
		slotsPerCategory: refreshedData.slotsPerCategory,
		inventoryCapacity: refreshedData.inventoryCapacity
	};
}

function executeChestAction(
	packet: CommandReportHomeChestActionReq,
	player: Player,
	home: Home
): Promise<ChestError | null> {
	const itemCategory = packet.itemCategory as ItemCategory;

	switch (packet.action) {
		case HomeConstants.CHEST_ACTIONS.DEPOSIT:
			return processChestDeposit(player, home, packet.slot, itemCategory);
		case HomeConstants.CHEST_ACTIONS.WITHDRAW:
			return processChestWithdraw(player, home, packet.slot, itemCategory);
		case HomeConstants.CHEST_ACTIONS.SWAP:
			return processChestSwap({
				player,
				home,
				inventorySlotNumber: packet.slot,
				chestSlotNumber: packet.chestSlot,
				itemCategory
			});
		default:
			return Promise.resolve(HomeConstants.CHEST_ERRORS.INVALID);
	}
}

async function processChestDeposit(
	player: Player,
	home: Home,
	inventorySlot: number,
	itemCategory: ItemCategory
): Promise<ChestError | null> {
	const slot = await InventorySlots.getItem(player.id, inventorySlot, itemCategory);
	if (!slot || slot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const emptyChestSlot = await HomeChestSlots.findEmptySlot(home.id, itemCategory);
	if (!emptyChestSlot) {
		return HomeConstants.CHEST_ERRORS.CHEST_FULL;
	}

	// Move item to chest
	emptyChestSlot.itemId = slot.itemId;
	emptyChestSlot.itemLevel = slot.itemLevel;
	emptyChestSlot.itemEnchantmentId = slot.itemEnchantmentId;
	await emptyChestSlot.save();

	// Clear inventory slot
	await clearInventorySlot(slot);

	return null;
}

/**
 * Clear an inventory slot after depositing/moving its item.
 * Active slots are reset, backup slots are destroyed.
 */
async function clearInventorySlot(slot: InventorySlot): Promise<void> {
	if (slot.slot === 0) {
		resetItemFields(slot);
		await slot.save();
	}
	else {
		await slot.destroy();
	}
}

async function clearChestSlot(chestSlot: HomeChestSlot): Promise<void> {
	resetItemFields(chestSlot);
	await chestSlot.save();
}

/**
 * Reset item-related fields on any slot-like entity.
 */
function resetItemFields(target: {
	itemId: number; itemLevel: number; itemEnchantmentId: string | null;
}): void {
	target.itemId = 0;
	target.itemLevel = 0;
	target.itemEnchantmentId = null;
}

/**
 * Item data to be placed in an inventory slot.
 */
interface ItemPlacement {
	itemId: number;
	itemLevel: ItemLevel;
	itemEnchantmentId: string | null;
}

async function assignItemToSlot(slot: InventorySlot, item: ItemPlacement): Promise<void> {
	slot.itemId = item.itemId;
	slot.itemLevel = item.itemLevel;
	slot.itemEnchantmentId = item.itemEnchantmentId;
	await slot.save();
}

/**
 * Attempt to place an item in the player's inventory.
 * Returns null on success, HomeConstants.CHEST_ERRORS.INVENTORY_FULL if no space.
 */
async function placeItemInInventory(
	player: Player,
	home: Home,
	itemCategory: ItemCategory,
	item: ItemPlacement
): Promise<ChestError | null> {
	const playerInventory = await InventorySlots.getOfPlayer(player.id);

	// Priority 1: active slot (slot 0) if empty
	const activeSlot = playerInventory.find(s => s.itemCategory === itemCategory && s.slot === 0);
	if (activeSlot && activeSlot.itemId === 0) {
		await assignItemToSlot(activeSlot, item);
		return null;
	}

	// Priority 2: backup slots
	const backupSlots = playerInventory.filter(s => s.itemCategory === itemCategory && s.slot > 0);
	const inventoryInfo = await InventoryInfo.findOne({ where: { playerId: player.id } });
	const homeBonus = home.getLevel()?.features.inventoryBonus;
	const bonusForCategory = homeBonus ? getSlotCountForCategory(homeBonus, itemCategory) : 0;
	const maxSlots = inventoryInfo ? inventoryInfo.slotLimitForCategory(itemCategory) + bonusForCategory : 1;

	const emptyBackupSlot = backupSlots.find(s => s.itemId === 0);
	if (emptyBackupSlot) {
		await assignItemToSlot(emptyBackupSlot, item);
		return null;
	}

	// maxSlots includes the equipped slot (slot 0), so backup capacity is maxSlots - 1
	if (backupSlots.length < maxSlots - 1) {
		const nextSlot = backupSlots.length > 0 ? Math.max(...backupSlots.map(s => s.slot)) + 1 : 1;
		await InventorySlot.create({
			playerId: player.id,
			slot: nextSlot,
			itemCategory,
			itemId: item.itemId,
			itemLevel: item.itemLevel,
			itemEnchantmentId: item.itemEnchantmentId
		});
		return null;
	}

	return HomeConstants.CHEST_ERRORS.INVENTORY_FULL;
}

async function processChestWithdraw(
	player: Player,
	home: Home,
	chestSlotNumber: number,
	itemCategory: ItemCategory
): Promise<ChestError | null> {
	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const error = await placeItemInInventory(player, home, itemCategory, {
		itemId: chestSlot.itemId,
		itemLevel: chestSlot.itemLevel as ItemLevel,
		itemEnchantmentId: chestSlot.itemEnchantmentId
	});

	if (error) {
		return error;
	}

	// Clear the chest slot
	await clearChestSlot(chestSlot);

	return null;
}

interface ChestSwapParams {
	player: Player;
	home: Home;
	inventorySlotNumber: number;
	chestSlotNumber: number;
	itemCategory: ItemCategory;
}

async function processChestSwap({
	player,
	home,
	inventorySlotNumber,
	chestSlotNumber,
	itemCategory
}: ChestSwapParams): Promise<ChestError | null> {
	const inventorySlot = await InventorySlots.getItem(player.id, inventorySlotNumber, itemCategory);
	if (!inventorySlot || inventorySlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	// Swap: exchange items between inventory slot and chest slot
	const tempItemId = inventorySlot.itemId;
	const tempItemLevel = inventorySlot.itemLevel;
	const tempItemEnchantmentId = inventorySlot.itemEnchantmentId;

	inventorySlot.itemId = chestSlot.itemId;
	inventorySlot.itemLevel = chestSlot.itemLevel;
	inventorySlot.itemEnchantmentId = chestSlot.itemEnchantmentId;

	chestSlot.itemId = tempItemId;
	chestSlot.itemLevel = tempItemLevel;
	chestSlot.itemEnchantmentId = tempItemEnchantmentId;

	await inventorySlot.save();
	await chestSlot.save();

	return null;
}

/*
 * ========================
 * Garden system
 * ========================
 */

/**
 * Build garden data for the home feature in the city collector.
 * Calculates growth progress and storage capacity.
 */
export async function buildGardenData(
	home: Home,
	homeLevel: HomeLevel,
	player: Player
): Promise<GardenData> {
	const gardenPlots = homeLevel.features.gardenPlots;
	const earthQuality = homeLevel.features.gardenEarthQuality;

	// Ensure garden slots exist
	await HomeGardenSlots.ensureSlotsForLevel(home.id, gardenPlots);

	// Ensure plant storage exists
	await HomePlantStorages.initializeStorage(home.id);

	// Load garden slots
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);

	// Build plot status
	const plots: GardenData["plots"] = gardenSlots.map(slot => {
		const plant = PlantConstants.getPlantById(slot.plantId as PlantId);
		const effectiveGrowthTime = plant
			? GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)
			: 0;
		const isReady = slot.isReady(effectiveGrowthTime);
		const progress = slot.getGrowthProgress(effectiveGrowthTime);

		let remainingSeconds = 0;
		if (plant && slot.plantedAt && !isReady) {
			const elapsed = (Date.now() - slot.plantedAt.valueOf()) / 1000;
			remainingSeconds = Math.max(0, Math.ceil(effectiveGrowthTime - elapsed));
		}

		return {
			slot: slot.slot,
			plantId: slot.plantId as PlantId | 0,
			growthProgress: progress,
			isReady,
			remainingSeconds
		};
	});

	// Build plant storage data
	const storageEntries = await HomePlantStorages.getOfHome(home.id);
	const maxCapacity = home.level;
	const plantStorage: GardenData["plantStorage"] = storageEntries.map(entry => ({
		plantId: entry.plantId as PlantId,
		quantity: entry.quantity,
		maxCapacity
	}));

	// Get player's seed
	await PlayerPlantSlots.initializeSlots(player.id, 1);
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	const hasSeed = seedSlot !== null && seedSlot.plantId !== 0;

	return {
		plots,
		plantStorage,
		hasSeed,
		seedPlantId: seedSlot?.plantId ?? 0,
		totalPlots: gardenPlots
	};
}

/**
 * Handle garden harvest — collect all ready plants from the garden
 */
export async function handleGardenHarvest(
	keycloakId: string,
	_packet: CommandReportGardenHarvestReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const homeLevel = home?.getLevel();

	if (!player || !home || !homeLevel) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS
		});
	}

	const earthQuality = homeLevel.features.gardenEarthQuality;
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const maxCapacity = home.level;

	let plantsHarvested = 0;
	const compostResults: {
		plantId: PlantId; materialId: number;
	}[] = [];
	const harvestedSlots: number[] = [];

	for (const slot of gardenSlots) {
		if (slot.isEmpty()) {
			continue;
		}

		const plant = PlantConstants.getPlantById(slot.plantId as PlantId);
		if (!plant) {
			continue;
		}

		const effectiveGrowthTime = GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality);
		if (!slot.isReady(effectiveGrowthTime)) {
			continue;
		}

		harvestedSlots.push(slot.slot);

		// Try to store the plant in the chest
		const overflow = await HomePlantStorages.addPlant(home.id, slot.plantId, 1, maxCapacity);

		if (overflow > 0) {
			// Plant storage is full — compost the plant into a random material from its set
			const materialId = RandomUtils.crowniclesRandom.pick(plant.compostMaterials);
			await Materials.giveMaterial(player.id, materialId, 1);
			compostResults.push({
				plantId: plant.id,
				materialId
			});
		}
		else {
			plantsHarvested++;
		}

		// Reset the growth timer (plant regrows automatically)
		await HomeGardenSlots.resetGrowthTimer(home.id, slot.slot);
	}

	// Fetch updated plant storage to return to frontend
	const updatedStorage = await HomePlantStorages.getOfHome(home.id);
	const plantStorage = updatedStorage
		.filter(s => s.quantity > 0)
		.map(s => ({
			plantId: s.plantId as PlantId,
			quantity: s.quantity,
			maxCapacity
		}));

	return makePacket(CommandReportGardenHarvestRes, {
		plantsHarvested,
		plantsComposted: compostResults.length,
		compostResults,
		plantStorage,
		harvestedSlots
	});
}

/**
 * Handle garden plant — plant a seed in a specific garden plot
 */
export async function handleGardenPlant(
	keycloakId: string,
	packet: CommandReportGardenPlantReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const homeLevel = home?.getLevel();

	if (!player || !home || !homeLevel) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_SEED
		});
	}

	// Check if player has a seed
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (!seedSlot || seedSlot.plantId === 0) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_SEED
		});
	}

	// Check if the garden slot is empty (auto-find if -1)
	let gardenSlot: HomeGardenSlot | null;
	if (packet.gardenSlot === -1) {
		gardenSlot = await HomeGardenSlots.findEmptySlot(home.id);
	}
	else {
		gardenSlot = await HomeGardenSlots.getSlot(home.id, packet.gardenSlot);
	}

	if (!gardenSlot || !gardenSlot.isEmpty()) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT
		});
	}

	// Check if the plant type is already planted in another slot
	const allGardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const alreadyPlanted = allGardenSlots.some(s => s.plantId === seedSlot.plantId);
	if (alreadyPlanted) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.SEED_ALREADY_PLANTED
		});
	}

	const plantId = seedSlot.plantId;

	// Plant the seed
	await HomeGardenSlots.plantSeed(home.id, gardenSlot.slot, plantId);

	// Consume the seed
	await PlayerPlantSlots.clearSeed(player.id);

	return makePacket(CommandReportGardenPlantRes, {
		plantId,
		gardenSlot: gardenSlot.slot
	});
}

/**
 * Build refreshed plant transfer data (storage + player slots) for response.
 */
async function buildPlantTransferResponseData(
	homeId: number,
	playerId: number,
	maxCapacity: number
): Promise<{
	plantStorage: CommandReportPlantTransferRes["plantStorage"];
	playerPlantSlots: CommandReportPlantTransferRes["playerPlantSlots"];
}> {
	const homeStorage = await HomePlantStorages.getOfHome(homeId);
	const plantSlots = await PlayerPlantSlots.getPlantSlots(playerId);

	return {
		plantStorage: homeStorage
			.filter(s => s.quantity > 0)
			.map(s => ({
				plantId: s.plantId as PlantId,
				quantity: s.quantity,
				maxCapacity
			})),
		playerPlantSlots: plantSlots.map(s => ({
			slot: s.slot,
			plantId: s.plantId as PlantId | 0
		}))
	};
}

/**
 * Handle a plant transfer (deposit/withdraw) between player inventory and home storage.
 */
export async function handlePlantTransfer(
	keycloakId: string,
	packet: CommandReportPlantTransferReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;

	if (!player || !home) {
		return makePacket(CommandReportPlantTransferRes, {
			success: false,
			error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID,
			plantStorage: [],
			playerPlantSlots: []
		});
	}

	const maxCapacity = home.level;

	if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT) {
		/*
		 * Deposit: move a plant from player's inventory to home storage.
		 * playerSlot identifies which plant slot to take from.
		 */
		const plantSlots = await PlayerPlantSlots.getPlantSlots(player.id);
		const sourceSlot = plantSlots.find(s => s.slot === packet.playerSlot);

		if (!sourceSlot || sourceSlot.plantId === 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		const overflow = await HomePlantStorages.addPlant(home.id, sourceSlot.plantId, 1, maxCapacity);
		if (overflow > 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.STORAGE_FULL,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		await PlayerPlantSlots.clearPlant(player.id, packet.playerSlot);
	}
	else if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW) {
		/*
		 * Withdraw: move a plant from home storage to player's inventory.
		 * plantId identifies what to withdraw, playerSlot where to put it.
		 */
		const storageEntry = await HomePlantStorages.getForPlant(home.id, packet.plantId);
		if (!storageEntry || storageEntry.quantity <= 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		// Find an empty plant slot
		const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(player.id);
		if (!emptySlot) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NO_EMPTY_SLOT,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		await HomePlantStorages.removePlant(home.id, packet.plantId);
		await PlayerPlantSlots.setPlant(player.id, emptySlot.slot, packet.plantId);
	}
	else {
		return makePacket(CommandReportPlantTransferRes, {
			success: false,
			error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID,
			plantStorage: [],
			playerPlantSlots: []
		});
	}

	const refreshedData = await buildPlantTransferResponseData(home.id, player.id, maxCapacity);

	return makePacket(CommandReportPlantTransferRes, {
		success: true,
		...refreshedData
	});
}
