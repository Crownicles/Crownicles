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

type InventoryReaction = {
	slot: number;
	itemCategory: number;
};

type PlayerInventorySlot = Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>[number];

type InventoryMaterialStock = Map<number, number>;

type BlacksmithUpgradeItem = NonNullable<ReactionCollectorCityData["blacksmith"]>["upgradeableItems"][number];

type BlacksmithDisenchantItem = NonNullable<ReactionCollectorCityData["blacksmith"]>["disenchantableItems"][number];

type BlacksmithUpgradeExecutionData = {
	totalCost: number;
	boughtMaterials: boolean;
	hasAllMaterials: boolean;
	materialsToConsume: {
		materialId: number;
		quantity: number;
	}[];
};

function getBlacksmithData(player: Player, data: ReactionCollectorCityData): NonNullable<ReactionCollectorCityData["blacksmith"]> | null {
	const { blacksmith } = data;
	if (!blacksmith) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use blacksmith but no blacksmith data available.`);
		return null;
	}

	return blacksmith;
}

function logMissingInventoryItem(player: Player, action: string): null {
	CrowniclesLogger.error(`Player ${player.keycloakId} tried to ${action} an item that doesn't exist in their inventory.`);
	return null;
}

function getBlacksmithItem(
	player: Player,
	reaction: ReactionCollectorBlacksmithUpgradeReaction,
	data: ReactionCollectorCityData,
	action: "upgrade"
): BlacksmithUpgradeItem | null;
function getBlacksmithItem(
	player: Player,
	reaction: ReactionCollectorBlacksmithDisenchantReaction,
	data: ReactionCollectorCityData,
	action: "disenchant"
): BlacksmithDisenchantItem | null;
function getBlacksmithItem(
	player: Player,
	reaction: {
		slot: number;
		itemCategory: number;
	},
	data: ReactionCollectorCityData,
	action: "upgrade" | "disenchant"
): BlacksmithUpgradeItem | BlacksmithDisenchantItem | null {
	const blacksmith = getBlacksmithData(player, data);
	if (!blacksmith) {
		return null;
	}

	const items = action === "upgrade" ? blacksmith.upgradeableItems : blacksmith.disenchantableItems;
	const found = items.find(
		item => item.slot === reaction.slot && item.category === reaction.itemCategory
	);
	if (!found) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to ${action} an item that doesn't exist in the blacksmith.`);
		return null;
	}

	return found;
}

async function getPlayerMaterialStock(playerId: number): Promise<InventoryMaterialStock> {
	const playerMaterials = await Materials.getPlayerMaterials(playerId);
	return new Map(playerMaterials.map(material => [material.materialId, material.quantity]));
}

function buildBlacksmithUpgradeExecutionData(params: {
	itemToUpgrade: BlacksmithUpgradeItem;
	materialStock: InventoryMaterialStock;
	buyMaterials: boolean;
}): BlacksmithUpgradeExecutionData {
	const {
		itemToUpgrade, materialStock, buyMaterials
	} = params;
	const missingMaterials = itemToUpgrade.requiredMaterials
		.filter(material => (materialStock.get(material.materialId) ?? 0) < material.quantity)
		.map(material => ({
			rarity: material.rarity,
			quantity: material.quantity - (materialStock.get(material.materialId) ?? 0)
		}));
	const hasAllMaterials = missingMaterials.length === 0;
	const boughtMaterials = buyMaterials && !hasAllMaterials;
	const missingMaterialsCost = getMaterialsPurchasePrice(missingMaterials);

	return {
		totalCost: itemToUpgrade.upgradeCost + (boughtMaterials ? missingMaterialsCost : 0),
		boughtMaterials,
		hasAllMaterials,
		materialsToConsume: itemToUpgrade.requiredMaterials
			.map(material => ({
				materialId: material.materialId,
				quantity: Math.min(material.quantity, materialStock.get(material.materialId) ?? 0)
			}))
			.filter(material => material.quantity > 0)
	};
}

function pushBlacksmithMissingMoneyResponse(response: CrowniclesPacket[], totalCost: number, playerMoney: number): void {
	response.push(makePacket(CommandReportBlacksmithNotEnoughMoneyRes, {
		missingMoney: totalCost - playerMoney
	}));
}

async function findInventorySlotForReaction(playerId: number, reaction: InventoryReaction): Promise<PlayerInventorySlot | undefined> {
	return await InventorySlots.getOfPlayer(playerId)
		.then(slots => slots.find(slot => slot.slot === reaction.slot && slot.itemCategory === reaction.itemCategory));
}

async function getInventorySlotForReaction(
	player: Player,
	reaction: InventoryReaction,
	action: string
): Promise<PlayerInventorySlot | null> {
	const inventorySlot = await findInventorySlotForReaction(player.id, reaction);
	return inventorySlot ?? logMissingInventoryItem(player, action);
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

	const materialsToConsume = itemToUpgrade!.requiredMaterials.map(m => ({
		materialId: m.materialId,
		quantity: m.quantity
	}));

	const consumed = await Materials.consumeMaterials(player.id, materialsToConsume);
	if (!consumed) {
		response.push(makePacket(CommandReportUpgradeItemMissingMaterialsRes, {}));
		return;
	}

	const inventorySlot = await getInventorySlotForReaction(player, reaction, "upgrade");
	if (!inventorySlot) {
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

	const itemToUpgrade = getBlacksmithItem(player, reaction, data, "upgrade");
	if (!itemToUpgrade) {
		return;
	}

	const materialStock = await getPlayerMaterialStock(player.id);
	const executionData = buildBlacksmithUpgradeExecutionData({
		itemToUpgrade,
		materialStock,
		buyMaterials: reaction.buyMaterials
	});

	if (player.money < executionData.totalCost) {
		pushBlacksmithMissingMoneyResponse(response, executionData.totalCost, player.money);
		return;
	}

	if (!executionData.boughtMaterials && !executionData.hasAllMaterials) {
		response.push(makePacket(CommandReportBlacksmithMissingMaterialsRes, {}));
		return;
	}

	if (executionData.materialsToConsume.length > 0) {
		const consumed = await Materials.consumeMaterials(player.id, executionData.materialsToConsume);
		if (!consumed) {
			response.push(makePacket(CommandReportBlacksmithMissingMaterialsRes, {}));
			return;
		}
	}

	// Spend money
	await player.spendMoney({
		response,
		amount: executionData.totalCost,
		reason: NumberChangeReason.BLACKSMITH_UPGRADE
	});

	const inventorySlot = await getInventorySlotForReaction(player, reaction, "upgrade");
	if (!inventorySlot) {
		return;
	}

	inventorySlot.itemLevel = itemToUpgrade.nextLevel;
	await inventorySlot.save();
	await player.save();

	response.push(makePacket(CommandReportBlacksmithUpgradeRes, {
		itemCategory: reaction.itemCategory,
		newItemLevel: itemToUpgrade.nextLevel,
		totalCost: executionData.totalCost,
		boughtMaterials: executionData.boughtMaterials
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

	const itemToDisenchant = getBlacksmithItem(player, reaction, data, "disenchant");
	if (!itemToDisenchant) {
		return;
	}

	if (player.money < itemToDisenchant.disenchantCost) {
		pushBlacksmithMissingMoneyResponse(response, itemToDisenchant.disenchantCost, player.money);
		return;
	}

	await player.spendMoney({
		response,
		amount: itemToDisenchant.disenchantCost,
		reason: NumberChangeReason.BLACKSMITH_DISENCHANT
	});

	const inventorySlot = await getInventorySlotForReaction(player, reaction, "disenchant");
	if (!inventorySlot) {
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
