import InventorySlot from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	ItemUpgradeLevel, RoyalBlacksmithConstants
} from "../../../../Lib/src/constants/BlacksmithConstants";
import {
	getMaterialsPurchasePrice, getUpgradePrice
} from "../../../../Lib/src/utils/BlacksmithUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { getBlacksmithItemData } from "./ReportBlacksmithService";

type RoyalBlacksmithData = NonNullable<ReactionCollectorCityData["royalBlacksmith"]>;
type RoyalUpgradeableItem = RoyalBlacksmithData["upgradeableItems"][number];

/**
 * Inventory inspection result used to pick the right narrative branch.
 */
type InventoryStatus = {
	hasAnyPrimaryItem: boolean;
	hasAnyAtTargetLevel: boolean;
	hasAnyAtPreviousLevel: boolean;
};

function inspectInventory(playerInventory: InventorySlot[]): InventoryStatus {
	const result: InventoryStatus = {
		hasAnyPrimaryItem: false,
		hasAnyAtTargetLevel: false,
		hasAnyAtPreviousLevel: false
	};
	const targetLevel = RoyalBlacksmithConstants.TARGET_LEVEL;
	const previousLevel = targetLevel - 1;

	for (const slot of playerInventory) {
		const itemData = getBlacksmithItemData(slot);
		if (!itemData) {
			continue;
		}
		result.hasAnyPrimaryItem = true;
		const level = slot.itemLevel ?? 0;
		if (level === targetLevel) {
			result.hasAnyAtTargetLevel = true;
		}
		else if (level === previousLevel) {
			result.hasAnyAtPreviousLevel = true;
		}
	}

	return result;
}

function buildUpgradeableItems(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	player: Player,
	playerGems: number
): RoyalUpgradeableItem[] {
	const upgradeableItems: RoyalUpgradeableItem[] = [];
	const targetLevel = RoyalBlacksmithConstants.TARGET_LEVEL;
	const previousLevel = targetLevel - 1;

	for (const inventorySlot of playerInventory) {
		const itemData = getBlacksmithItemData(inventorySlot);
		if (!itemData) {
			continue;
		}

		const currentLevel = inventorySlot.itemLevel ?? 0;
		if (currentLevel !== previousLevel) {
			continue;
		}

		const requiredMaterialsRaw = itemData.getUpgradeMaterials(targetLevel);

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

		const requiredMaterials: RoyalUpgradeableItem["requiredMaterials"] = [];
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

		const upgradeCost = getUpgradePrice(targetLevel as ItemUpgradeLevel, itemData.rarity);
		const missingMaterialsCost = getMaterialsPurchasePrice(missingMaterials);
		const gemCost = RoyalBlacksmithConstants.GEM_COST_PER_RARITY[itemData.rarity as ItemRarity];
		const hasEnoughGems = playerGems >= gemCost;
		const canUpgrade = hasAllMaterials && player.money >= upgradeCost && hasEnoughGems;
		const canBuyAndUpgrade = !hasAllMaterials && player.money >= upgradeCost + missingMaterialsCost && hasEnoughGems;

		upgradeableItems.push({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player) as MainItemDetails,
			upgradeCost,
			gemCost,
			itemRarity: itemData.rarity,
			requiredMaterials,
			missingMaterialsCost,
			hasAllMaterials,
			canUpgrade,
			canBuyAndUpgrade
		});
	}

	return upgradeableItems;
}

/**
 * Build Royal Blacksmith data for the city collector. Only invoked when the
 * city has `hasRoyalBlacksmith: true`. Computes a Core-authoritative status
 * so Discord can render the right narrative without re-deriving eligibility.
 */
export async function buildRoyalBlacksmithData(
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>,
	player: Player
): Promise<RoyalBlacksmithData> {
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	const playerGems = missionInfo.gems;
	const playerLevel = player.level;

	// Player too low-level: refuse upfront, no item list needed.
	if (playerLevel < RoyalBlacksmithConstants.MIN_PLAYER_LEVEL) {
		return {
			status: "not_worthy",
			playerLevel,
			upgradeableItems: [],
			playerMoney: player.money,
			playerGems
		};
	}

	const inventoryStatus = inspectInventory(playerInventory);
	const upgradeableItems = buildUpgradeableItems(playerInventory, playerMaterialMap, player, playerGems);

	// Worthy player but nothing the Royal Blacksmith would touch.
	if (upgradeableItems.length === 0) {
		if (inventoryStatus.hasAnyPrimaryItem && inventoryStatus.hasAnyAtTargetLevel && !inventoryStatus.hasAnyAtPreviousLevel) {
			return {
				status: "all_maxed",
				playerLevel,
				upgradeableItems: [],
				playerMoney: player.money,
				playerGems
			};
		}
		return {
			status: "items_too_low",
			playerLevel,
			upgradeableItems: [],
			playerMoney: player.money,
			playerGems
		};
	}

	return {
		status: "ready",
		playerLevel,
		upgradeableItems,
		playerMoney: player.money,
		playerGems
	};
}

// Re-export the type for convenience.
export type { RoyalBlacksmithData };
