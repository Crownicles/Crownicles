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
	ChestSlotsPerCategory, getSlotCountForCategory
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
	ReactionCollectorBlacksmithDisenchantReaction,
	ReactionCollectorHomeChestDepositReaction,
	ReactionCollectorHomeChestWithdrawReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import {
	BlacksmithConstants, ItemUpgradeLevel
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
	CommandReportHomeChestFullRes,
	CommandReportHomeChestInventoryFullRes,
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
	CommandReportUpgradeItemRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	HomeChestSlots
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
import { crowniclesInstance } from "../../index";

// Type aliases for commonly used nested types from ReactionCollectorCityData
type EnchanterData = NonNullable<ReactionCollectorCityData["enchanter"]>;
type HomeData = ReactionCollectorCityData["home"];
type UpgradeStationData = NonNullable<NonNullable<HomeData["owned"]>["upgradeStation"]>;
type BlacksmithData = NonNullable<ReactionCollectorCityData["blacksmith"]>;

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
	let owned;
	if (isHomeInCity) {
		upgradeStation = buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel!, player);
		chest = await buildChestData(home!, homeLevel!, playerInventory, player);
		owned = {
			level: home!.level,
			features: homeLevel!.features,
			upgradeStation,
			chest
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
): Promise<NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["chest"]>> {
	const slotsPerCategory = homeLevel.features.chestSlots;

	// Ensure chest slots exist for the current home level
	await HomeChestSlots.ensureSlotsForLevel(home.id, slotsPerCategory);

	// Load all chest slots
	const allChestSlots = await HomeChestSlots.getOfHome(home.id);

	// Build chest items (non-empty slots)
	const chestItems: NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["chest"]>["chestItems"] = allChestSlots
		.filter(slot => slot.itemId !== 0)
		.map(slot => ({
			slot: slot.slot,
			category: slot.itemCategory,
			details: slot.itemWithDetails(player)
		}));

	// Build depositable items (all inventory items with itemId !== 0, including active items)
	const depositableItems: NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["chest"]>["depositableItems"] = playerInventory
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

	return {
		chestItems,
		depositableItems,
		slotsPerCategory,
		inventoryCapacity
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

/**
 * Handle home chest deposit reaction — player stores an item from inventory into the chest
 * @returns true if the deposit succeeded, false otherwise
 */
export async function handleHomeChestDepositReaction(
	player: Player,
	data: ReactionCollectorCityData,
	reaction: ReactionCollectorHomeChestDepositReaction,
	response: CrowniclesPacket[]
): Promise<boolean> {
	await player.reload();

	const homeData = data.home.owned;
	if (!homeData?.chest) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to deposit into chest without valid chest data.`);
		return false;
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to deposit into chest but has no home.`);
		return false;
	}

	// Find the inventory slot the player wants to deposit
	const inventorySlot = await InventorySlots.getItem(player.id, reaction.inventorySlot, reaction.itemCategory);
	if (!inventorySlot || inventorySlot.itemId === 0) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to deposit empty/invalid inventory slot.`);
		return false;
	}

	// Find an empty chest slot for this category
	const emptyChestSlot = await HomeChestSlots.findEmptySlot(home.id, reaction.itemCategory);
	if (!emptyChestSlot) {
		response.push(makePacket(CommandReportHomeChestFullRes, {}));
		return false;
	}

	// Move item from inventory to chest
	emptyChestSlot.itemId = inventorySlot.itemId;
	emptyChestSlot.itemLevel = inventorySlot.itemLevel;
	emptyChestSlot.itemEnchantmentId = inventorySlot.itemEnchantmentId;
	await emptyChestSlot.save();

	// Clear the inventory slot
	if (inventorySlot.slot === 0) {
		// Active slot: reset to default empty item (keep the slot row)
		inventorySlot.itemId = 0;
		inventorySlot.itemLevel = 0;
		inventorySlot.itemEnchantmentId = null;
		await inventorySlot.save();
	}
	else {
		// Backup slot: destroy it since empty backup slots shouldn't persist
		await inventorySlot.destroy();
	}

	return true;
}

/**
 * Handle home chest withdraw reaction — player retrieves an item from the chest into their inventory
 * @returns true if the withdraw succeeded, false otherwise
 */
export async function handleHomeChestWithdrawReaction(
	player: Player,
	data: ReactionCollectorCityData,
	reaction: ReactionCollectorHomeChestWithdrawReaction,
	response: CrowniclesPacket[]
): Promise<boolean> {
	await player.reload();

	const homeData = data.home.owned;
	if (!homeData?.chest) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to withdraw from chest without valid chest data.`);
		return false;
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to withdraw from chest but has no home.`);
		return false;
	}

	// Find the chest slot the player wants to withdraw
	const chestSlot = await HomeChestSlots.getSlot(home.id, reaction.chestSlot, reaction.itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to withdraw empty/invalid chest slot.`);
		return false;
	}

	// Try to place the item in the player's inventory
	const itemToPlace: ItemPlacement = {
		itemId: chestSlot.itemId,
		itemLevel: chestSlot.itemLevel,
		itemEnchantmentId: chestSlot.itemEnchantmentId
	};
	const placed = await placeItemInInventory(player, home, reaction.itemCategory, itemToPlace);

	if (!placed) {
		// Inventory full — all backup slots occupied and at max capacity
		response.push(makePacket(CommandReportHomeChestInventoryFullRes, {}));
		return false;
	}

	// Clear the chest slot
	chestSlot.itemId = 0;
	chestSlot.itemLevel = 0;
	chestSlot.itemEnchantmentId = null;
	await chestSlot.save();

	return true;
}

/**
 * Handle a chest action request (deposit/withdraw) sent directly from Discord via AsyncPacketSender.
 * Returns refreshed chest data for the Discord side to update the view in-place.
 */
export async function handleChestAction(
	keycloakId: string,
	packet: CommandReportHomeChestActionReq
): Promise<Omit<CommandReportHomeChestActionRes, "name">> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return buildChestActionError("invalid");
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return buildChestActionError("invalid");
	}

	const homeLevel = home.getLevel();
	if (!homeLevel) {
		return buildChestActionError("invalid");
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
): Promise<string | null> {
	const itemCategory = packet.itemCategory as ItemCategory;

	switch (packet.action) {
		case "deposit":
			return processChestDeposit(player, home, packet.slot, itemCategory);
		case "withdraw":
			return processChestWithdraw(player, home, packet.slot, itemCategory);
		case "swap":
			return processChestSwap({
				player,
				home,
				inventorySlotNumber: packet.slot,
				chestSlotNumber: packet.chestSlot,
				itemCategory
			});
		default:
			return Promise.resolve("invalid");
	}
}

function buildChestActionError(error: string): Omit<CommandReportHomeChestActionRes, "name"> {
	return {
		success: false,
		error,
		chestItems: [],
		depositableItems: [],
		slotsPerCategory: {
			weapon: 0, armor: 0, object: 0, potion: 0
		},
		inventoryCapacity: {
			weapon: 0, armor: 0, object: 0, potion: 0
		}
	};
}

async function processChestDeposit(
	player: Player,
	home: Home,
	inventorySlot: number,
	itemCategory: ItemCategory
): Promise<string | null> {
	const slot = await InventorySlots.getItem(player.id, inventorySlot, itemCategory);
	if (!slot || slot.itemId === 0) {
		return "invalid";
	}

	const emptyChestSlot = await HomeChestSlots.findEmptySlot(home.id, itemCategory);
	if (!emptyChestSlot) {
		return "chestFull";
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
		slot.itemId = 0;
		slot.itemLevel = 0;
		slot.itemEnchantmentId = null;
		await slot.save();
	}
	else {
		await slot.destroy();
	}
}

/**
 * Item data to be placed in an inventory slot.
 */
interface ItemPlacement {
	itemId: number;
	itemLevel: number;
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
 * Returns null on success, "inventoryFull" if no space.
 */
async function placeItemInInventory(
	player: Player,
	home: Home,
	itemCategory: ItemCategory,
	item: ItemPlacement
): Promise<string | null> {
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

	return "inventoryFull";
}

async function processChestWithdraw(
	player: Player,
	home: Home,
	chestSlotNumber: number,
	itemCategory: ItemCategory
): Promise<string | null> {
	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return "invalid";
	}

	const error = await placeItemInInventory(player, home, itemCategory, {
		itemId: chestSlot.itemId,
		itemLevel: chestSlot.itemLevel,
		itemEnchantmentId: chestSlot.itemEnchantmentId
	});

	if (error) {
		return error;
	}

	// Clear the chest slot
	chestSlot.itemId = 0;
	chestSlot.itemLevel = 0;
	chestSlot.itemEnchantmentId = null;
	await chestSlot.save();

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
}: ChestSwapParams): Promise<string | null> {
	const inventorySlot = await InventorySlots.getItem(player.id, inventorySlotNumber, itemCategory);
	if (!inventorySlot || inventorySlot.itemId === 0) {
		return "invalid";
	}

	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return "invalid";
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
