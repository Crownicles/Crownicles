import { Player } from "../database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { Materials } from "../database/game/models/Material";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import {
	ReactionCollectorCityData,
	ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportRoyalBlacksmithMissingMaterialsRes,
	CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes,
	CommandReportRoyalBlacksmithMockBadgeGivenRes,
	CommandReportRoyalBlacksmithNotEnoughGemsRes,
	CommandReportRoyalBlacksmithNotEnoughMoneyRes,
	CommandReportRoyalBlacksmithUpgradeRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	ItemUpgradeLevel, RoyalBlacksmithConstants
} from "../../../../Lib/src/constants/BlacksmithConstants";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { Badge } from "../../../../Lib/src/types/Badge";
import {
	LockKey, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { updateUpgradeMissionsUnderLock } from "./ReportCityBlacksmithService";
import { crowniclesInstance } from "../../app";

type RoyalBlacksmithData = NonNullable<ReactionCollectorCityData["royalBlacksmith"]>;
type RoyalUpgradeableItem = RoyalBlacksmithData["upgradeableItems"][number];

type ExecutionData = {
	totalMoneyCost: number;
	gemCost: number;
	boughtMaterials: boolean;
	hasAllMaterials: boolean;
	materialsToConsume: {
		materialId: number;
		quantity: number;
	}[];
	materialsExtraCost: number;
};

export function findRoyalBlacksmithItem(
	player: Player,
	data: ReactionCollectorCityData,
	reaction: ReactionCollectorRoyalBlacksmithUpgradeReaction
): RoyalUpgradeableItem | null {
	const royal = data.royalBlacksmith;
	if (!royal) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use the Royal Blacksmith but no data was sent.`);
		return null;
	}
	if (royal.status !== "ready") {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade at the Royal Blacksmith while status is ${royal.status}.`);
		return null;
	}
	const found = royal.upgradeableItems.find(
		item => item.slot === reaction.slot && item.category === reaction.itemCategory
	);
	if (!found) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to upgrade a non-listed item at the Royal Blacksmith.`);
		return null;
	}
	return found;
}

async function getPlayerMaterialStock(playerId: number): Promise<Map<number, number>> {
	const materials = await Materials.getPlayerMaterials(playerId);
	return new Map(materials.map(m => [m.materialId, m.quantity]));
}

export function buildExecutionData(params: {
	item: RoyalUpgradeableItem;
	materialStock: Map<number, number>;
	buyMaterials: boolean;
}): ExecutionData {
	const {
		item, materialStock, buyMaterials
	} = params;
	const missingMaterials = item.requiredMaterials
		.filter(material => (materialStock.get(material.materialId) ?? 0) < material.quantity)
		.map(material => ({
			rarity: material.rarity,
			quantity: material.quantity - (materialStock.get(material.materialId) ?? 0)
		}));
	const hasAllMaterials = missingMaterials.length === 0;
	const boughtMaterials = buyMaterials && !hasAllMaterials;
	const materialsExtraCost = boughtMaterials ? getMaterialsPurchasePrice(missingMaterials) : 0;

	return {
		totalMoneyCost: item.upgradeCost + materialsExtraCost,
		gemCost: item.gemCost,
		boughtMaterials,
		hasAllMaterials,
		materialsToConsume: item.requiredMaterials
			.map(material => ({
				materialId: material.materialId,
				quantity: Math.min(material.quantity, materialStock.get(material.materialId) ?? 0)
			}))
			.filter(material => material.quantity > 0),
		materialsExtraCost
	};
}

function pushMissingMoney(response: CrowniclesPacket[], total: number, owned: number): void {
	response.push(makePacket(CommandReportRoyalBlacksmithNotEnoughMoneyRes, {
		missingMoney: total - owned
	}));
}

function pushMissingGems(response: CrowniclesPacket[], needed: number, owned: number): void {
	response.push(makePacket(CommandReportRoyalBlacksmithNotEnoughGemsRes, {
		missingGems: needed - owned
	}));
}

/**
 * Handle a Royal Blacksmith upgrade reaction — player upgrades a level-4 item to level 5.
 *
 * Concurrency: locks both Player (money + inventory) and PlayerMissionsInfo (gems)
 * so concurrent confirmations cannot lost-update either currency. Re-validates all
 * costs against the locked rows before any mutation.
 */
export async function handleRoyalBlacksmithUpgradeReaction(
	player: Player,
	reaction: ReactionCollectorRoyalBlacksmithUpgradeReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	const item = findRoyalBlacksmithItem(player, data, reaction);
	if (!item) {
		return;
	}

	const materialStock = await getPlayerMaterialStock(player.id);
	const execution = buildExecutionData({
		item,
		materialStock,
		buyMaterials: reaction.buyMaterials
	});

	if (player.money < execution.totalMoneyCost) {
		pushMissingMoney(response, execution.totalMoneyCost, player.money);
		return;
	}

	if (!execution.boughtMaterials && !execution.hasAllMaterials) {
		response.push(makePacket(CommandReportRoyalBlacksmithMissingMaterialsRes, {}));
		return;
	}

	// Ensure PlayerMissionsInfo row exists before attempting to lock it.
	await PlayerMissionsInfos.getOfPlayer(player.id);

	const keys: readonly LockKey[] = [
		Player.lockKey(player.id),
		PlayerMissionsInfo.lockKey(player.id)
	] as const;

	await withLockedEntities(keys, async locked => {
		const lockedPlayer = locked[0] as Player;
		const lockedMissionsInfo = locked[1] as PlayerMissionsInfo;
		await executeRoyalUpgradeUnderLock({
			lockedPlayer, lockedMissionsInfo, item, execution, reaction, response
		});
	});
}

/**
 * Inside-lock body: re-validate money + gems against the locked rows, consume materials,
 * spend money + gems, bump the inventory slot to level 5, and award the easter-egg badge
 * if the item rarity is below the threshold.
 */
async function executeRoyalUpgradeUnderLock(params: {
	lockedPlayer: Player;
	lockedMissionsInfo: PlayerMissionsInfo;
	item: RoyalUpgradeableItem;
	execution: ExecutionData;
	reaction: ReactionCollectorRoyalBlacksmithUpgradeReaction;
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		lockedPlayer, lockedMissionsInfo, item, execution, reaction, response
	} = params;

	const inventorySlot = await validateRoyalUpgradeUnderLock({
		lockedPlayer, lockedMissionsInfo, execution, reaction, response
	});
	if (!inventorySlot) {
		return;
	}

	if (execution.materialsToConsume.length > 0) {
		const consumed = await Materials.consumeMaterials(lockedPlayer.id, execution.materialsToConsume);
		if (!consumed) {
			response.push(makePacket(CommandReportRoyalBlacksmithMissingMaterialsRes, {}));
			return;
		}
	}

	await lockedPlayer.spendMoney({
		response,
		amount: execution.totalMoneyCost,
		reason: NumberChangeReason.ROYAL_BLACKSMITH_UPGRADE
	});

	if (execution.gemCost > 0) {
		await lockedMissionsInfo.spendGems(execution.gemCost, response, NumberChangeReason.ROYAL_BLACKSMITH_UPGRADE_GEMS);
	}

	inventorySlot.itemLevel = RoyalBlacksmithConstants.TARGET_LEVEL;
	await inventorySlot.save();
	await lockedPlayer.save();

	response.push(makePacket(CommandReportRoyalBlacksmithUpgradeRes, {
		itemCategory: reaction.itemCategory,
		upgradeCost: item.upgradeCost,
		materialsCost: execution.materialsExtraCost,
		gemCost: execution.gemCost,
		boughtMaterials: execution.boughtMaterials
	}));

	await updateUpgradeMissionsUnderLock(lockedPlayer, response, inventorySlot, RoyalBlacksmithConstants.TARGET_LEVEL);

	await maybeAwardSentimentalBadge({
		lockedPlayer, item, response
	});

	logRoyalUpgrade({
		lockedPlayer, execution, reaction
	});
}

/**
 * Reload and validate the target slot and the player's funds before any spending.
 * Runs inside the caller's player lock; returns the validated slot or null (after
 * pushing the relevant error packet) when the upgrade must be aborted.
 */
async function validateRoyalUpgradeUnderLock(params: {
	lockedPlayer: Player;
	lockedMissionsInfo: PlayerMissionsInfo;
	execution: ExecutionData;
	reaction: ReactionCollectorRoyalBlacksmithUpgradeReaction;
	response: CrowniclesPacket[];
}): Promise<InventorySlot | null> {
	const {
		lockedPlayer, lockedMissionsInfo, execution, reaction, response
	} = params;

	/*
	 * Reload and validate the target slot BEFORE any spending: a stale menu replayed
	 * after a first successful upgrade would otherwise pay again and re-set an
	 * already-upgraded item, so abort if it is no longer at the upgradeable level.
	 */
	const slots = await InventorySlots.getOfPlayer(lockedPlayer.id);
	const inventorySlot = slots.find(s => s.slot === reaction.slot && s.itemCategory === reaction.itemCategory);
	if (!inventorySlot || inventorySlot.itemLevel !== RoyalBlacksmithConstants.TARGET_LEVEL - 1) {
		CrowniclesLogger.error(`Player ${lockedPlayer.keycloakId} Royal Blacksmith upgrade: target slot is no longer upgradeable (stale menu replay).`);
		return null;
	}

	if (lockedPlayer.money < execution.totalMoneyCost) {
		pushMissingMoney(response, execution.totalMoneyCost, lockedPlayer.money);
		return null;
	}
	if (lockedMissionsInfo.gems < execution.gemCost) {
		pushMissingGems(response, execution.gemCost, lockedMissionsInfo.gems);
		return null;
	}
	return inventorySlot;
}

/**
 * Emit the blacksmith upgrade log entry for the current city, if the player is in one.
 */
function logRoyalUpgrade(params: {
	lockedPlayer: Player;
	execution: ExecutionData;
	reaction: ReactionCollectorRoyalBlacksmithUpgradeReaction;
}): void {
	const {
		lockedPlayer, execution, reaction
	} = params;
	const cityId = lockedPlayer.getCurrentCityId();
	if (!cityId) {
		return;
	}
	crowniclesInstance?.logsDatabase.logBlacksmithUpgrade({
		keycloakId: lockedPlayer.keycloakId,
		cityId,
		itemCategory: reaction.itemCategory,
		slot: reaction.slot,
		fromLevel: RoyalBlacksmithConstants.TARGET_LEVEL - 1,
		toLevel: RoyalBlacksmithConstants.TARGET_LEVEL as ItemUpgradeLevel,
		totalCost: execution.totalMoneyCost,
		boughtMaterials: execution.boughtMaterials,
		materialsCost: execution.boughtMaterials ? execution.materialsExtraCost : null
	}).then();
}

/**
 * Easter egg: if the upgraded item's rarity is strictly below the threshold,
 * award the SENTIMENTAL_CRAFTER badge. If the player already has it, send the
 * "extra mockery" packet instead.
 */
async function maybeAwardSentimentalBadge(params: {
	lockedPlayer: Player;
	item: RoyalUpgradeableItem;
	response: CrowniclesPacket[];
}): Promise<void> {
	const {
		lockedPlayer, item, response
	} = params;
	const rarity = item.itemRarity as ItemRarity;

	if (rarity >= RoyalBlacksmithConstants.MOCK_BADGE_RARITY_THRESHOLD) {
		return;
	}

	const alreadyHad = await PlayerBadgesManager.hasBadge(lockedPlayer.id, Badge.SENTIMENTAL_CRAFTER);
	if (alreadyHad) {
		response.push(makePacket(CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes, {}));
		return;
	}

	await PlayerBadgesManager.addBadge(lockedPlayer.id, Badge.SENTIMENTAL_CRAFTER);
	response.push(makePacket(CommandReportRoyalBlacksmithMockBadgeGivenRes, {}));
}
