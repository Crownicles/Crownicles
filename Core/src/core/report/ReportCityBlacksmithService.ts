import { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	ReactionCollectorCityData,
	ReactionCollectorUpgradeItemReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorBlacksmithDisenchantReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBlacksmithDisenchantRes,
	CommandReportBlacksmithMissingMaterialsRes,
	CommandReportBlacksmithNotEnoughMoneyRes,
	CommandReportBlacksmithUpgradeRes,
	CommandReportUpgradeItemMaxLevelRes,
	CommandReportUpgradeItemMissingMaterialsRes,
	CommandReportUpgradeItemRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { Materials } from "../database/game/models/Material";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

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
