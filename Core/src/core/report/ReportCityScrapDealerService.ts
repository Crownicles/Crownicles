import {
	ItemConstants, ItemCategory
} from "../../../../Lib/src/constants/ItemConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { ScrapDealerConstants } from "../../../../Lib/src/constants/ScrapDealerConstants";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	ScrapDealerData, ScrapDealerItem
} from "../../../../Lib/src/types/ScrapDealerData";
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
import { InventorySlot } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { withLockedPlayerAndMissions } from "../utils/withLockedPlayerAndMissions";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../utils/MaterialLootUtils";
import { CommandReportScrapDealerRecycleRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { getItemValue } from "../utils/ItemUtils";
import { crowniclesInstance } from "../../app";

function getScrapDealerItemData(inventorySlot: InventorySlot): MainItem | null {
	if (!inventorySlot.isPrimaryEquipment()) {
		return null;
	}
	return inventorySlot.itemCategory === ItemCategory.WEAPON
		? WeaponDataController.instance.getById(inventorySlot.itemId) ?? null
		: ArmorDataController.instance.getById(inventorySlot.itemId) ?? null;
}

type ScrapDealerMaterialUnit = {
	materialId: number;
	rarity: MaterialRarity;
};

/**
 * Every single material the item consumed to reach its level, interleaved across rarities so that
 * taking the first N units keeps the proportions of the item's own recipe instead of draining all
 * the common materials first.
 */
function getRecipeMaterialUnits(item: MainItem, itemLevel: number): ScrapDealerMaterialUnit[] {
	const unitsByRarity = new Map<MaterialRarity, ScrapDealerMaterialUnit[]>();
	for (let level = ItemConstants.MIN_UPGRADE_LEVEL; level <= Math.max(itemLevel, ItemConstants.MIN_UPGRADE_LEVEL); level++) {
		for (const material of item.getUpgradeMaterials(level)) {
			const units = unitsByRarity.get(material.rarity) ?? [];
			units.push({
				materialId: Number.parseInt(material.id, 10),
				rarity: material.rarity
			});
			unitsByRarity.set(material.rarity, units);
		}
	}

	const interleavedUnits: {
		unit: ScrapDealerMaterialUnit; position: number;
	}[] = [];
	for (const units of unitsByRarity.values()) {
		units.sort((firstUnit, secondUnit) => firstUnit.materialId - secondUnit.materialId);
		for (const [index, unit] of units.entries()) {
			interleavedUnits.push({
				unit,
				position: index / units.length
			});
		}
	}
	interleavedUnits.sort((firstEntry, secondEntry) =>
		firstEntry.position - secondEntry.position || firstEntry.unit.rarity - secondEntry.unit.rarity);
	return interleavedUnits.map(entry => entry.unit);
}

/**
 * Materials given back when scrapping an equipment. The types come from the item's own upgrade
 * recipe, and materials are handed out one by one until their blacksmith purchase price reaches the
 * item's sell price scaled by its upgrade level. The recipe is cycled through as many times as
 * needed: the bulk price increase makes each extra material more expensive, so the loop terminates.
 */
export function getScrapDealerMaterials(item: MainItem, itemLevel: number): MaterialQuantity[] {
	const recipeUnits = getRecipeMaterialUnits(item, itemLevel);
	if (recipeUnits.length === 0) {
		return [];
	}

	const materialsValue = getItemValue(item)
		* (ScrapDealerConstants.BASE_VALUE_MULTIPLIER + itemLevel * ScrapDealerConstants.VALUE_MULTIPLIER_PER_LEVEL);
	const givenMaterials: MaterialQuantity[] = [];
	const purchasedMaterials: {
		rarity: MaterialRarity; quantity: number;
	}[] = [];

	for (let unitIndex = 0; getMaterialsPurchasePrice(purchasedMaterials) < materialsValue; unitIndex++) {
		const unit = recipeUnits[unitIndex % recipeUnits.length];
		purchasedMaterials.push({
			rarity: unit.rarity,
			quantity: 1
		});
		const alreadyGiven = givenMaterials.find(material => material.materialId === unit.materialId);
		if (alreadyGiven) {
			alreadyGiven.quantity++;
		}
		else {
			givenMaterials.push({
				materialId: unit.materialId,
				quantity: 1
			});
		}
	}
	return givenMaterials;
}

/** An enchanted equipment must be disenchanted at the blacksmith first, so its enchantment is never silently destroyed. */
function isRecyclable(inventorySlot: InventorySlot): boolean {
	return !inventorySlot.isEquipped() && inventorySlot.itemEnchantmentId === null;
}

function buildRecyclableItem(inventorySlot: InventorySlot, player: Player): ScrapDealerItem | null {
	if (!isRecyclable(inventorySlot)) {
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
			.filter((item): item is ScrapDealerItem => item !== null)
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

	await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
		const slotFilter = {
			playerId: lockedPlayer.id,
			slot: reaction.slot,
			itemCategory: reaction.itemCategory,
			itemId: reaction.itemId
		};
		const inventorySlot = await InventorySlot.findOne({ where: slotFilter });
		if (!inventorySlot || !isRecyclable(inventorySlot)) {
			CrowniclesLogger.warn(`Player ${player.keycloakId} tried to recycle an equipment that is not recyclable anymore.`);
			return;
		}

		const itemData = getScrapDealerItemData(inventorySlot);
		if (!itemData) {
			CrowniclesLogger.warn(`Player ${player.keycloakId} tried to recycle an unknown equipment.`);
			return;
		}

		const itemLevel = inventorySlot.itemLevel ?? 0;
		const materialLoot = getScrapDealerMaterials(itemData, itemLevel);
		if (materialLoot.length === 0) {
			CrowniclesLogger.warn(`Player ${player.keycloakId} tried to recycle an equipment yielding no material.`);
			return;
		}

		if (await InventorySlot.destroy({ where: slotFilter }) === 0) {
			return;
		}

		await applyMaterialLoot(lockedPlayer.id, materialLoot);
		await updateCollectMaterialsMission(lockedPlayer, response, materialLoot);
		response.push(makePacket(CommandReportScrapDealerRecycleRes, { materialLoot }));

		const cityId = lockedPlayer.getCurrentCityId();
		if (cityId) {
			crowniclesInstance?.logsDatabase.logScrapDealerRecycle({
				keycloakId: lockedPlayer.keycloakId,
				cityId,
				itemCategory: reaction.itemCategory,
				itemId: reaction.itemId,
				itemLevel,
				slot: reaction.slot
			}).then();
		}
	});
}
