import InventorySlot from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import {
	BlacksmithConstants, ItemUpgradeLevel
} from "../../../../Lib/src/constants/BlacksmithConstants";
import {
	getDisenchantPrice, getMaterialsPurchasePrice, getUpgradePrice
} from "../../../../Lib/src/utils/BlacksmithUtils";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";

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
