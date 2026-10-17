import {
	ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { ScrapDealerConstants } from "../../../../Lib/src/constants/ScrapDealerConstants";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialRarityQuantity } from "../../../../Lib/src/types/MaterialRarityQuantity";
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
import { InventorySlot } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { withLockedPlayerAndMissions } from "../utils/withLockedPlayerAndMissions";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../utils/MaterialLootUtils";
import { CommandReportScrapDealerRecycleRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { getItemValue } from "../utils/ItemUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlessingManager } from "../blessings/BlessingManager";
import { crowniclesInstance } from "../../app";
import { getBlacksmithItemData } from "./ReportBlacksmithService";

type ScrapDealerMaterialUnit = {
	materialId: number;
	rarity: MaterialRarity;
};

/** A recipe unit tagged with its relative position inside its own rarity bucket, used to interleave rarities. */
type PositionedMaterialUnit = {
	unit: ScrapDealerMaterialUnit;
	position: number;
};

/** A material unit tagged with its relative position inside one upgrade level. */
type PositionedLevelMaterialUnit = {
	unit: ScrapDealerMaterialUnit;
	position: number;
	level: number;
};

/** Identifies the exact inventory row being recycled, so the lookup and the deletion cannot drift apart. */
type RecycleSlotFilter = {
	playerId: number;
	slot: number;
	itemCategory: ItemCategory;
	itemId: number;
};

/** Every single material the item consumed for one upgrade level, bucketed by rarity. */
function groupRecipeUnitsByRarity(item: MainItem, level: number): Map<MaterialRarity, ScrapDealerMaterialUnit[]> {
	const unitsByRarity = new Map<MaterialRarity, ScrapDealerMaterialUnit[]>();
	for (const material of item.getUpgradeMaterials(level)) {
		const units = unitsByRarity.get(material.rarity) ?? [];
		units.push({
			materialId: Number.parseInt(material.id, 10),
			rarity: material.rarity
		});
		unitsByRarity.set(material.rarity, units);
	}
	return unitsByRarity;
}

/** Tag each unit with its relative position inside its own rarity bucket, so rarities can be zipped together. */
function positionUnitsInsideBucket(units: ScrapDealerMaterialUnit[]): PositionedMaterialUnit[] {
	units.sort((firstUnit, secondUnit) => firstUnit.materialId - secondUnit.materialId);
	return units.map((unit, index) => ({
		unit,
		position: index / units.length
	}));
}

/** Materials consumed for one level, interleaved across that level's rarities. */
function getRecipeMaterialUnitsForLevel(item: MainItem, level: number): ScrapDealerMaterialUnit[] {
	const interleavedUnits = [...groupRecipeUnitsByRarity(item, level).values()]
		.flatMap(positionUnitsInsideBucket);
	interleavedUnits.sort((firstEntry, secondEntry) =>
		firstEntry.position - secondEntry.position || firstEntry.unit.rarity - secondEntry.unit.rarity);
	return interleavedUnits.map(entry => entry.unit);
}

/**
 * Every single material the item consumed to reach its level, interleaved across levels so that
 * taking the first N units keeps materials from every reached upgrade instead of draining one
 * level before considering the next one.
 */
function getRecipeMaterialUnits(item: MainItem, itemLevel: number): ScrapDealerMaterialUnit[] {
	const maxLevel = Math.max(itemLevel, ItemConstants.MIN_UPGRADE_LEVEL);
	const positionedUnits: PositionedLevelMaterialUnit[] = [];
	for (let level = ItemConstants.MIN_UPGRADE_LEVEL; level <= maxLevel; level++) {
		const levelUnits = getRecipeMaterialUnitsForLevel(item, level);
		for (const [position, unit] of levelUnits.entries()) {
			positionedUnits.push({
				unit,
				position: position / levelUnits.length,
				level
			});
		}
	}

	positionedUnits.sort((firstEntry, secondEntry) =>
		firstEntry.position - secondEntry.position || firstEntry.level - secondEntry.level);
	return positionedUnits.map(entry => entry.unit);
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
	const purchasedMaterials: MaterialRarityQuantity[] = [];

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

/** Coins given back on top of the materials, based on the item sell price, blessing included. */
export function getScrapDealerMoney(item: MainItem): number {
	return BlessingManager.getInstance().applyMoneyBlessing(Math.round(getItemValue(item) * ScrapDealerConstants.MONEY_VALUE_RATIO));
}

/** An enchanted equipment must be disenchanted at the blacksmith first, so its enchantment is never silently destroyed. */
function isRecyclable(inventorySlot: InventorySlot): boolean {
	return !inventorySlot.isEquipped() && inventorySlot.itemEnchantmentId === null;
}

function buildRecyclableItem(inventorySlot: InventorySlot, player: Player): ScrapDealerItem | null {
	if (!isRecyclable(inventorySlot)) {
		return null;
	}

	const itemData = getBlacksmithItemData(inventorySlot);
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
		recoveredMaterials,
		recoveredMoney: getScrapDealerMoney(itemData)
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

/** The equipment the player asked to recycle, or null when the reaction does not match anything the scrap dealer listed. */
function findListedItem(
	data: ReactionCollectorCityData,
	reaction: ReactionCollectorScrapDealerRecycleReaction
): ScrapDealerItem | null {
	return data.scrapDealer?.recyclableItems.find(item =>
		item.slot === reaction.slot
		&& item.category === reaction.itemCategory
		&& item.itemId === reaction.itemId) ?? null;
}

/** The equipment as it currently stands in database, or null when it is gone or no longer recyclable. */
async function findRecyclableSlotUnderLock(slotFilter: RecycleSlotFilter): Promise<InventorySlot | null> {
	const inventorySlot = await InventorySlot.findOne({ where: slotFilter });
	return inventorySlot && isRecyclable(inventorySlot) ? inventorySlot : null;
}

function logRecycle(player: Locked<Player>, reaction: ReactionCollectorScrapDealerRecycleReaction, itemLevel: number): void {
	const cityId = player.getCurrentCityId();
	if (!cityId) {
		return;
	}
	crowniclesInstance?.logsDatabase.logScrapDealerRecycle({
		keycloakId: player.keycloakId,
		cityId,
		itemCategory: reaction.itemCategory,
		itemId: reaction.itemId,
		itemLevel,
		slot: reaction.slot
	}).then();
}

async function grantRecycleRewardsUnderLock(params: {
	player: Locked<Player>;
	item: MainItem;
	materialLoot: MaterialQuantity[];
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		player, item, materialLoot, response
	} = params;

	await applyMaterialLoot(player.id, materialLoot);
	await updateCollectMaterialsMission(player, response, materialLoot);

	const moneyGained = getScrapDealerMoney(item);
	await player.addMoney({
		response,
		amount: moneyGained,
		reason: NumberChangeReason.SCRAP_DEALER_RECYCLE,
		ignoreBlessing: true
	});
	await player.save();

	response.push(makePacket(CommandReportScrapDealerRecycleRes, {
		materialLoot,
		moneyGained
	}));
}

async function applyScrapDealerRecycleUnderLock(
	player: Locked<Player>,
	reaction: ReactionCollectorScrapDealerRecycleReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	const slotFilter: RecycleSlotFilter = {
		playerId: player.id,
		slot: reaction.slot,
		itemCategory: reaction.itemCategory,
		itemId: reaction.itemId
	};
	const inventorySlot = await findRecyclableSlotUnderLock(slotFilter);
	const itemData = inventorySlot ? getBlacksmithItemData(inventorySlot) : null;
	if (!inventorySlot || !itemData) {
		CrowniclesLogger.warn(`Player ${player.keycloakId} tried to recycle an equipment that is not recyclable anymore.`);
		return;
	}

	const itemLevel = inventorySlot.itemLevel ?? 0;
	const materialLoot = getScrapDealerMaterials(itemData, itemLevel);
	if (materialLoot.length === 0) {
		CrowniclesLogger.warn(`Player ${player.keycloakId} tried to recycle an equipment yielding no material.`);
		return;
	}

	// Guards against a concurrent recycle of the same slot: only the call that actually deleted the row pays out.
	if (await InventorySlot.destroy({ where: slotFilter }) === 0) {
		return;
	}

	await grantRecycleRewardsUnderLock({
		player,
		item: itemData,
		materialLoot,
		response
	});
	logRecycle(player, reaction, itemLevel);
}

export async function handleScrapDealerRecycleReaction(
	player: Player,
	reaction: ReactionCollectorScrapDealerRecycleReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	if (!findListedItem(data, reaction)) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to recycle an item that is not listed by the scrap dealer.`);
		return;
	}

	await withLockedPlayerAndMissions(player.id, lockedPlayer => applyScrapDealerRecycleUnderLock(lockedPlayer, reaction, response));
}
