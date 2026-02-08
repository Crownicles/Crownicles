import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	City
} from "../../data/City";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
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
import { BlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";
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
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Settings } from "../database/game/models/Setting";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
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

/**
 * Build enchanter data for the city reaction collector
 */
export function buildEnchanterData(
	playerInventory: InventorySlot[],
	player: Player,
	enchantment: ItemEnchantment,
	enchantmentId: string,
	isPlayerMage: boolean
): NonNullable<ReactionCollectorCityData["enchanter"]> {
	const isEquipment = (i: InventorySlot): boolean => (i.isWeapon() || i.isArmor()) && i.itemId !== 0;

	return {
		enchantableItems: playerInventory
			.filter(i => isEquipment(i) && !i.itemEnchantmentId)
			.map(i => ({
				category: i.itemCategory,
				slot: i.slot,
				details: i.itemWithDetails(player) as MainItemDetails
			})),
		isInventoryEmpty: playerInventory.filter(isEquipment).length === 0,
		hasAtLeastOneEnchantedItem: playerInventory.some(i => isEquipment(i) && Boolean(i.itemEnchantmentId)),
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
	player: Player,
	city: City,
	home: Home | null,
	homeLevel: HomeLevel | null,
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>
): Promise<ReactionCollectorCityData["home"]> {
	const isHomeInCity = Boolean(home && home.cityId === city.id && homeLevel);
	const nextHomeUpgrade = homeLevel ? HomeLevel.getNextUpgrade(homeLevel, player.level) : null;

	const upgradeStation = isHomeInCity
		? buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel!, player)
		: undefined;

	const owned = isHomeInCity
		? {
			level: home!.level,
			features: homeLevel!.features,
			upgradeStation
		}
		: undefined;

	const homesCount = await Homes.getHomesCount();

	const manage: ReactionCollectorCityData["home"]["manage"] = {
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
	playerInventory: Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>,
	playerMaterialMap: Map<number, number>,
	homeLevel: HomeLevel,
	player: Player
): NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["upgradeStation"]> {
	const maxUpgradeableRarity = homeLevel.features.upgradeItemMaximumRarity;
	const maxLevelAtHome = homeLevel.features.maxItemUpgradeLevel;

	const upgradeableItems: NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["upgradeStation"]>["upgradeableItems"] = [];

	for (const inventorySlot of playerInventory) {
		// Only process weapons and armors with a valid item
		if ((!inventorySlot.isWeapon() && !inventorySlot.isArmor()) || inventorySlot.itemId === 0) {
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
 * Build blacksmith data for the city collector.
 * The blacksmith allows upgrading items beyond home level and disenchanting items.
 */
export function buildBlacksmithData(
	playerInventory: Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>,
	playerMaterialMap: Map<number, number>,
	player: Player
): NonNullable<ReactionCollectorCityData["blacksmith"]> {
	const upgradeableItems: NonNullable<ReactionCollectorCityData["blacksmith"]>["upgradeableItems"] = [];
	const disenchantableItems: NonNullable<ReactionCollectorCityData["blacksmith"]>["disenchantableItems"] = [];

	for (const inventorySlot of playerInventory) {
		// Only process weapons and armors with a valid item
		if ((!inventorySlot.isWeapon() && !inventorySlot.isArmor()) || inventorySlot.itemId === 0) {
			continue;
		}

		// Get the item data
		const itemData = inventorySlot.isWeapon()
			? WeaponDataController.instance.getById(inventorySlot.itemId)
			: ArmorDataController.instance.getById(inventorySlot.itemId);

		if (!itemData) {
			continue;
		}

		const currentLevel = inventorySlot.itemLevel ?? 0;

		// Check if item can be upgraded at the blacksmith (level < MAX_UPGRADE_LEVEL)
		if (currentLevel < BlacksmithConstants.MAX_UPGRADE_LEVEL) {
			const nextLevel = currentLevel + 1 as 1 | 2 | 3 | 4;
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

			const upgradeCost = BlacksmithConstants.getUpgradePrice(nextLevel, itemData.rarity);
			const missingMaterialsCost = BlacksmithConstants.getMaterialsPurchasePrice(missingMaterials);

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

		// Check if item can be disenchanted (has an enchantment)
		if (inventorySlot.itemEnchantmentId) {
			const enchantment = ItemEnchantment.getById(inventorySlot.itemEnchantmentId);
			if (enchantment) {
				disenchantableItems.push({
					slot: inventorySlot.slot,
					category: inventorySlot.itemCategory,
					details: inventorySlot.itemWithDetails(player) as MainItemDetails,
					enchantmentId: inventorySlot.itemEnchantmentId,
					enchantmentType: enchantment.kind.type.id,
					disenchantCost: BlacksmithConstants.getDisenchantPrice(itemData.rarity)
				});
			}
		}
	}

	return {
		upgradeableItems,
		disenchantableItems,
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
 * Handle enchant reaction — player enchants an item at the enchanter
 */
export async function handleEnchantReaction(player: Player, reaction: ReactionCollectorEnchantReaction, response: CrowniclesPacket[]): Promise<void> {
	const enchantment = ItemEnchantment.getById(await Settings.ENCHANTER_ENCHANTMENT_ID.getValue());
	if (!enchantment) {
		CrowniclesLogger.error("No enchantment found for enchanter. Check ENCHANTER_ENCHANTMENT_ID setting.");
		return;
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
		return;
	}

	const itemToEnchant = await InventorySlots.getItem(player.id, reaction.slot, reaction.itemCategory);
	if (!itemToEnchant || !(itemToEnchant.isWeapon() || itemToEnchant.isArmor()) || itemToEnchant.itemEnchantmentId) {
		CrowniclesLogger.error("Player tried to enchant an item that doesn't exist or cannot be enchanted. It shouldn't happen because the player must not be able to switch items while in the collector.");
		response.push(makePacket(CommandReportItemCannotBeEnchantedRes, {}));
		return;
	}

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

	home.level = HomeLevel.getNextUpgrade(home.getLevel()!, player.level)!.level;

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

	// Calculate total cost
	let totalCost = itemToUpgrade.upgradeCost;
	const boughtMaterials = reaction.buyMaterials && !itemToUpgrade.hasAllMaterials;

	if (boughtMaterials) {
		totalCost += itemToUpgrade.missingMaterialsCost;
	}

	// Check if player has enough money
	if (player.money < totalCost) {
		response.push(makePacket(CommandReportBlacksmithNotEnoughMoneyRes, {
			missingMoney: totalCost - player.money
		}));
		return;
	}

	// If not buying materials, check if player has all required materials
	if (!boughtMaterials && !itemToUpgrade.hasAllMaterials) {
		response.push(makePacket(CommandReportBlacksmithMissingMaterialsRes, {}));
		return;
	}

	// Consume materials (only the ones the player has)
	const materialsToConsume = itemToUpgrade.requiredMaterials
		.filter(m => m.playerQuantity > 0)
		.map(m => ({
			materialId: m.materialId,
			quantity: Math.min(m.quantity, m.playerQuantity)
		}));

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
export async function handleCityShopReaction(
	player: Player,
	city: City,
	shopId: string,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
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
