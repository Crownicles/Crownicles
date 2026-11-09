import InventorySlot from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import {
	BLACKSMITH_LIMITS, BlacksmithConstants, BlacksmithLimit, ItemUpgradeLevel, RoyalBlacksmithConstants
} from "../../../../Lib/src/constants/BlacksmithConstants";
import {
	getEnchantmentTransferPrice, getMaterialsPurchasePrice, getUpgradePrice
} from "../../../../Lib/src/utils/BlacksmithUtils";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialRarityQuantity } from "../../../../Lib/src/types/MaterialRarityQuantity";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DisenchantableItem } from "../../../../Lib/src/types/DisenchantableItem";
import {
	EnchantmentTransferSource, EnchantmentTransferTarget
} from "../../../../Lib/src/types/EnchantmentTransfer";

type BlacksmithData = NonNullable<ReactionCollectorCityData["blacksmith"]>;
type BlacksmithItemData = ReturnType<typeof WeaponDataController.instance.getById> | ReturnType<typeof ArmorDataController.instance.getById> | null;

/**
 * Get the item data (weapon or armor) for an inventory slot
 */
export function getBlacksmithItemData(inventorySlot: InventorySlot): BlacksmithItemData {
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
			quantity: number; rarity: MaterialRarity;
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
		const missingMaterials: MaterialRarityQuantity[] = [];
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
		const canUpgrade = hasAllMaterials && player.money >= upgradeCost;
		const canBuyAndUpgrade = !hasAllMaterials && player.money >= upgradeCost + missingMaterialsCost;

		upgradeableItems.push({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player) as MainItemDetails,
			nextLevel,
			upgradeCost,
			requiredMaterials,
			missingMaterialsCost,
			hasAllMaterials,
			canUpgrade,
			canBuyAndUpgrade
		});
	}

	return upgradeableItems;
}

type EnchantedEquipment = {
	inventorySlot: InventorySlot;
	enchantment: ItemEnchantment;
};

/**
 * The player's weapons and armors carrying a known enchantment
 */
function getEnchantedEquipments(playerInventory: InventorySlot[]): EnchantedEquipment[] {
	return playerInventory.flatMap(inventorySlot => {
		const enchantment = inventorySlot.isPrimaryEquipment() && inventorySlot.itemEnchantmentId
			? ItemEnchantment.getById(inventorySlot.itemEnchantmentId)
			: null;
		return enchantment
			? [
				{
					inventorySlot, enchantment
				}
			]
			: [];
	});
}

function toDisenchantableItem(enchantedEquipment: EnchantedEquipment, player: Player): DisenchantableItem {
	const {
		inventorySlot, enchantment
	} = enchantedEquipment;
	return {
		slot: inventorySlot.slot,
		category: inventorySlot.itemCategory,
		details: inventorySlot.itemWithDetails(player) as MainItemDetails,
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id
	};
}

/**
 * Build the list of the player's enchanted weapons and armors
 */
export function buildDisenchantableItems(
	playerInventory: InventorySlot[],
	player: Player
): DisenchantableItem[] {
	return getEnchantedEquipments(playerInventory).map(enchantedEquipment => toDisenchantableItem(enchantedEquipment, player));
}

/**
 * The player's unenchanted equipments able to receive the given enchantment, with the price of the transfer onto each of them
 */
function buildEnchantmentTransferTargets(
	playerInventory: InventorySlot[],
	enchantment: ItemEnchantment,
	player: Player
): EnchantmentTransferTarget[] {
	return playerInventory
		.filter(inventorySlot => inventorySlot.canReceiveEnchantment(enchantment))
		.map(inventorySlot => {
			const details = inventorySlot.itemWithDetails(player) as MainItemDetails;
			const cost = getEnchantmentTransferPrice(details.rarity);
			return {
				slot: inventorySlot.slot,
				details,
				cost,
				canAfford: player.money >= cost
			};
		});
}

/**
 * Build the list of enchanted equipments whose enchantment the blacksmith can move onto another equipment
 */
function buildBlacksmithEnchantmentTransfers(
	playerInventory: InventorySlot[],
	player: Player
): EnchantmentTransferSource[] {
	return getEnchantedEquipments(playerInventory)
		.map(enchantedEquipment => ({
			...toDisenchantableItem(enchantedEquipment, player),
			targets: buildEnchantmentTransferTargets(playerInventory, enchantedEquipment.enchantment, player)
		}))
		.filter(source => source.targets.length > 0);
}

function blacksmithLimit(itemLevel: number): BlacksmithLimit | null {
	if (itemLevel >= RoyalBlacksmithConstants.TARGET_LEVEL) {
		return BLACKSMITH_LIMITS.MAXED;
	}
	return itemLevel >= BlacksmithConstants.MAX_UPGRADE_LEVEL ? BLACKSMITH_LIMITS.ROYAL_ONLY : null;
}

/**
 * Build the list of weapons and armors the blacksmith can no longer upgrade, so the player sees why
 */
function buildBlacksmithBeyondReachItems(
	playerInventory: InventorySlot[],
	player: Player
): BlacksmithData["beyondReachItems"] {
	return playerInventory.flatMap(inventorySlot => {
		const limit = getBlacksmithItemData(inventorySlot) ? blacksmithLimit(inventorySlot.itemLevel ?? 0) : null;
		return limit
			? [
				{
					slot: inventorySlot.slot,
					category: inventorySlot.itemCategory,
					details: inventorySlot.itemWithDetails(player) as MainItemDetails,
					limit
				}
			]
			: [];
	});
}

/**
 * Build blacksmith data for the city collector.
 * The blacksmith allows upgrading items beyond home level and moving an enchantment from one equipment to another.
 */
export function buildBlacksmithData(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	player: Player
): BlacksmithData {
	return {
		upgradeableItems: buildBlacksmithUpgradeableItems(playerInventory, playerMaterialMap, player),
		enchantmentTransfers: buildBlacksmithEnchantmentTransfers(playerInventory, player),
		beyondReachItems: buildBlacksmithBeyondReachItems(playerInventory, player),
		playerMoney: player.money
	};
}
