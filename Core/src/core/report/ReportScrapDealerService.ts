import {
	ItemConstants, ItemCategory
} from "../../../../Lib/src/constants/ItemConstants";
import { ScrapDealerConstants } from "../../../../Lib/src/constants/ScrapDealerConstants";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorScrapDealerRecycleReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { MainItem } from "../../data/MainItem";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import {
	InventorySlot
} from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { withLockedPlayerAndMissions } from "../utils/withLockedPlayerAndMissions";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../utils/MaterialLootUtils";
import { CommandReportScrapDealerRecycleRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";

type ScrapDealerData = NonNullable<ReactionCollectorCityData["scrapDealer"]>;
type RecyclableItem = ScrapDealerData["recyclableItems"][number];

function getScrapDealerItemData(inventorySlot: InventorySlot): MainItem | null {
	if (!inventorySlot.isPrimaryEquipment()) {
		return null;
	}
	return inventorySlot.itemCategory === ItemCategory.WEAPON
		? WeaponDataController.instance.getById(inventorySlot.itemId) ?? null
		: ArmorDataController.instance.getById(inventorySlot.itemId) ?? null;
}

function getRecoveryLevel(itemLevel: number): number {
	return Math.max(ItemConstants.MIN_UPGRADE_LEVEL, itemLevel);
}

export function getScrapDealerMaterials(item: MainItem, itemLevel: number): MaterialQuantity[] {
	const materialQuantities = new Map<number, number>();
	for (const material of item.getUpgradeMaterials(getRecoveryLevel(itemLevel))) {
		const materialId = Number.parseInt(material.id, 10);
		materialQuantities.set(materialId, (materialQuantities.get(materialId) ?? 0) + 1);
	}

	return Array.from(materialQuantities.entries()).map(([materialId, quantity]) => ({
		materialId,
		quantity: Math.ceil(quantity * ScrapDealerConstants.MATERIAL_RECOVERY_RATE)
	}));
}

function buildRecyclableItem(inventorySlot: InventorySlot, player: Player): RecyclableItem | null {
	if (inventorySlot.isEquipped()) {
		return null;
	}

	const itemData = getScrapDealerItemData(inventorySlot);
	if (!itemData) {
		return null;
	}

	const recoveredMaterials = getScrapDealerMaterials(itemData, inventorySlot.itemLevel ?? 0);
	if (recoveredMaterials.length === 0) {
		return null;
	}

	return {
		slot: inventorySlot.slot,
		category: inventorySlot.itemCategory,
		itemId: inventorySlot.itemId,
		details: inventorySlot.itemWithDetails(player) as MainItemDetails,
		recoveredMaterials
	};
}

export function buildScrapDealerData(
	playerInventory: InventorySlot[],
	player: Player
): ScrapDealerData {
	return {
		recyclableItems: playerInventory
			.map(inventorySlot => buildRecyclableItem(inventorySlot, player))
			.filter((item): item is RecyclableItem => item !== null)
	};
}

export async function handleScrapDealerRecycleReaction(
	player: Player,
	reaction: ReactionCollectorScrapDealerRecycleReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	const scrapDealer = data.scrapDealer;
	if (!scrapDealer) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use the scrap dealer without scrap dealer data.`);
		return;
	}

	const listedItem = scrapDealer.recyclableItems.find(item =>
		item.slot === reaction.slot
		&& item.category === reaction.itemCategory
		&& item.itemId === reaction.itemId);
	if (!listedItem) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to recycle an item that is not listed by the scrap dealer.`);
		return;
	}

	await player.reload();
	await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
		const inventorySlot = await InventorySlot.findOne({
			where: {
				playerId: lockedPlayer.id,
				slot: reaction.slot,
				itemCategory: reaction.itemCategory,
				itemId: reaction.itemId
			}
		});
		if (!inventorySlot || inventorySlot.isEquipped()) {
			return;
		}

		const itemData = getScrapDealerItemData(inventorySlot);
		if (!itemData) {
			return;
		}

		const materialLoot = getScrapDealerMaterials(itemData, inventorySlot.itemLevel ?? 0);
		if (materialLoot.length === 0) {
			return;
		}

		const deletedCount = await InventorySlot.destroy({
			where: {
				playerId: lockedPlayer.id,
				slot: reaction.slot,
				itemCategory: reaction.itemCategory,
				itemId: reaction.itemId
			}
		});
		if (deletedCount === 0) {
			return;
		}

		await applyMaterialLoot(lockedPlayer.id, materialLoot);
		await updateCollectMaterialsMission(lockedPlayer, response, materialLoot);
		response.push(makePacket(CommandReportScrapDealerRecycleRes, {
			itemCategory: reaction.itemCategory,
			materialLoot
		}));
	});
}
