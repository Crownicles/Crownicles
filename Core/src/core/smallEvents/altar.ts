import { SmallEventFuncs } from "../../data/SmallEvent";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlessingManager } from "../blessings/BlessingManager";
import { BlessingConstants } from "../../../../Lib/src/constants/BlessingConstants";
import {
	ReactionCollectorAltar, ReactionCollectorAltarContributeReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorAltar";
import Player from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventAltarContributedPacket,
	SmallEventAltarFirstEncounterPacket,
	SmallEventAltarNoContributionPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { Badge } from "../../../../Lib/src/types/Badge";
import { crowniclesInstance } from "../../index";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { Maps } from "../maps/Maps";
import { MissionsController } from "../missions/MissionsController";
import {
	daysToMilliseconds, hoursToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";

/**
 * Calculate the smart contribution amount based on player's money, remaining pool, and time until expiration.
 * Returns a value from SMART_CONTRIBUTION_AMOUNTS [50, 200, 250, 300, 500, 750, 1000, 1200, 1500].
 *
 * Score calculation (0-8 scale):
 * - Money factor (0-2): 0 = poor, 1 = middle, 2 = rich (100k+)
 * - Remaining factor (0-3): 0 = almost filled, 1 = low, 2 = medium, 3 = high (30k+)
 * - Time factor (0-3): 0 = plenty of time (3+ days), 1 = some time, 2 = less time, 3 = urgent (12h or less)
 */
function calculateSmartContributionAmount(player: Player, blessingManager: BlessingManager): number {
	const amounts = BlessingConstants.SMART_CONTRIBUTION_AMOUNTS;

	// Money factor (0-2): How rich is the player?
	let moneyFactor: number;
	if (player.money >= BlessingConstants.SMART_CONTRIBUTION_RICH_THRESHOLD) {
		moneyFactor = 2; // Rich
	}
	else if (player.money >= BlessingConstants.SMART_CONTRIBUTION_MIDDLE_THRESHOLD) {
		moneyFactor = 1; // Middle
	}
	else {
		moneyFactor = 0; // Poor
	}

	// Remaining factor (0-3): How much is left to fill?
	const remaining = blessingManager.getPoolThreshold() - blessingManager.getPoolAmount();
	let remainingFactor: number;
	if (remaining >= BlessingConstants.SMART_CONTRIBUTION_HIGH_REMAINING_THRESHOLD) {
		remainingFactor = 3; // A lot left
	}
	else if (remaining >= BlessingConstants.SMART_CONTRIBUTION_MEDIUM_REMAINING_THRESHOLD) {
		remainingFactor = 2; // Medium
	}
	else if (remaining >= BlessingConstants.SMART_CONTRIBUTION_LOW_REMAINING_THRESHOLD) {
		remainingFactor = 1; // Low
	}
	else {
		remainingFactor = 0; // Almost filled
	}

	// Time factor (0-3): How urgent is it?
	const timeRemaining = blessingManager.getPoolExpiresAt().getTime() - Date.now();
	let timeFactor: number;
	if (timeRemaining <= hoursToMilliseconds(BlessingConstants.SMART_CONTRIBUTION_URGENT_TIME_HOURS)) {
		timeFactor = 3; // Urgent
	}
	else if (timeRemaining <= hoursToMilliseconds(BlessingConstants.SMART_CONTRIBUTION_MEDIUM_TIME_HOURS)) {
		timeFactor = 2; // Less time
	}
	else if (timeRemaining <= daysToMilliseconds(BlessingConstants.SMART_CONTRIBUTION_RELAXED_TIME_DAYS)) {
		timeFactor = 1; // Some time
	}
	else {
		timeFactor = 0; // Plenty of time
	}

	// Total score (0-8)
	const score = Math.min(moneyFactor + remainingFactor + timeFactor, amounts.length - 1);

	return amounts[score];
}

/**
 * Calculate the contribution amounts for a given player, capped at the remaining pool amount.
 * Filters out non-positive values, deduplicates, and sorts ascending.
 */
function getContributionAmounts(player: Player, remainingPool: number, blessingManager: BlessingManager): number[] {
	const smartAmount = calculateSmartContributionAmount(player, blessingManager);

	const cappedAmounts = [
		BlessingConstants.FLAT_CONTRIBUTION,
		Math.max(1, Math.floor(player.money * BlessingConstants.MONEY_PERCENTAGE_CONTRIBUTION)),
		Math.max(1, player.level * BlessingConstants.LEVEL_MULTIPLIER_CONTRIBUTION),
		smartAmount
	].map(amount => Math.min(amount, remainingPool));

	return Array.from(new Set(cappedAmounts.filter(amount => amount > 0))).sort((a, b) => a - b);
}

interface AltarBonusResult {
	bonusGems: number;
	bonusItemGiven: boolean;
}

/**
 * Calculate bonus rewards for a contribution above the flat amount
 */
async function calculateBonusRewards(chosenAmount: number, player: Player): Promise<AltarBonusResult> {
	let bonusGems = 0;
	let bonusItemGiven = false;

	if (chosenAmount <= BlessingConstants.FLAT_CONTRIBUTION) {
		return {
			bonusGems,
			bonusItemGiven
		};
	}

	if (RandomUtils.crowniclesRandom.bool(Math.min(1, chosenAmount / BlessingConstants.CONTRIBUTION_GEMS_FULL_PROBABILITY_AMOUNT))) {
		bonusGems = BlessingConstants.CONTRIBUTION_BONUS_GEMS_AMOUNT;
		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await missionInfo.addGems(bonusGems, player.keycloakId, NumberChangeReason.BLESSING);
	}

	if (RandomUtils.crowniclesRandom.bool(BlessingConstants.CONTRIBUTION_BONUS_ITEM_PROBABILITY)) {
		bonusItemGiven = true;
	}

	return {
		bonusGems,
		bonusItemGiven
	};
}

/**
 * Check and award the Oracle Patron badge if the player has contributed enough over their lifetime.
 * Includes recentContributionAmount to account for contributions not yet persisted in logs.
 */
async function checkAndAwardOraclePatronBadge(player: Player, recentContributionAmount: number): Promise<boolean> {
	const lifetimeTotal = await crowniclesInstance.logsDatabase.getLifetimeContributions(player.keycloakId);
	if (lifetimeTotal + recentContributionAmount < BlessingConstants.ORACLE_PATRON_THRESHOLD) {
		return false;
	}
	if (await PlayerBadgesManager.hasBadge(player.id, Badge.ORACLE_PATRON)) {
		return false;
	}
	await PlayerBadgesManager.addBadge(player.id, Badge.ORACLE_PATRON);
	return true;
}

/**
 * Send a "no contribution" altar result and unblock the player.
 * Used for both refuse/timeout and not-enough-money cases.
 */
function sendNoContribution(
	response: CrowniclesPacket[],
	player: Player,
	blessingManager: BlessingManager,
	overrides: {
		amount?: number; hasEnoughMoney?: boolean;
	} = {}
): void {
	response.push(makePacket(SmallEventAltarNoContributionPacket, {
		amount: overrides.amount ?? 0,
		newPoolAmount: blessingManager.getPoolAmount(),
		poolThreshold: blessingManager.getPoolThreshold(),
		hasEnoughMoney: overrides.hasEnoughMoney ?? true
	}));
	BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT);
}

function getEndCallback(player: Player, context: PacketContext): EndCallback {
	return async (collector, response) => {
		const reaction = collector.getFirstReaction();
		const blessingManager = BlessingManager.getInstance();

		if (!reaction || reaction.reaction.type !== ReactionCollectorAltarContributeReaction.name) {
			// Player refused or timeout
			sendNoContribution(response, player, blessingManager);
			return;
		}

		const chosenAmount = (reaction.reaction.data as ReactionCollectorAltarContributeReaction).amount;

		// Check if player has enough money
		if (player.money < chosenAmount) {
			sendNoContribution(response, player, blessingManager, {
				amount: chosenAmount, hasEnoughMoney: false
			});
			return;
		}

		// Spend money
		await player.spendMoney({
			amount: chosenAmount,
			response,
			reason: NumberChangeReason.BLESSING
		});

		// Contribute to pool
		const blessingTriggered = await blessingManager.contribute(chosenAmount, player.keycloakId);

		const {
			bonusGems, bonusItemGiven
		} = await calculateBonusRewards(chosenAmount, player);
		const badgeAwarded = await checkAndAwardOraclePatronBadge(player, chosenAmount);

		response.push(makePacket(SmallEventAltarContributedPacket, {
			amount: chosenAmount,
			blessingTriggered,
			blessingType: blessingTriggered ? blessingManager.getActiveBlessingType() : 0,
			newPoolAmount: blessingManager.getPoolAmount(),
			poolThreshold: blessingManager.getPoolThreshold(),
			bonusGems,
			bonusItemGiven,
			badgeAwarded
		}));

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT);

		// Give bonus item after unblocking altar (giveItemToPlayer creates its own blocking for ACCEPT_ITEM)
		if (bonusItemGiven) {
			await giveItemToPlayer(response, context, player, generateRandomItem({
				minRarity: ItemRarity.SPECIAL
			}));
		}

		await player.save();

		// Update blessing contribution mission
		await MissionsController.update(player, response, {
			missionId: "contributeToBlessing",
			count: chosenAmount
		});
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player: Player): Promise<boolean> => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (await PlayerSmallEvents.playerSmallEventCount(player.id, "altar") !== 0) {
			return false;
		}

		const blessingManager = BlessingManager.getInstance();

		// Allow first encounter even during active blessing
		if (!blessingManager.canOracleAppear()) {
			return await LogsReadRequests.getSmallEventEncounterCount(player.keycloakId, "altar") === 0;
		}

		return true;
	},
	executeSmallEvent: async (response, player, context): Promise<void> => {
		// Update oracle missions for altar oracle
		await MissionsController.update(player, response, {
			missionId: "meetOracle",
			params: { tags: ["meetOracleAltar"] }
		});
		await MissionsController.update(player, response, {
			missionId: "meetAllOracles",
			params: { oracleId: "altar" }
		});

		// Small events are logged before execution (see ReportSmallEventService), so count <= 1 means first encounter
		const altarEncounterCount = await LogsReadRequests.getSmallEventEncounterCount(player.keycloakId, "altar");
		if (altarEncounterCount <= 1) {
			response.push(makePacket(SmallEventAltarFirstEncounterPacket, {}));
			return;
		}

		const blessingManager = BlessingManager.getInstance();
		const remainingPool = blessingManager.getPoolThreshold() - blessingManager.getPoolAmount();
		const contributionAmounts = getContributionAmounts(player, remainingPool, blessingManager);

		const collector = new ReactionCollectorAltar(
			contributionAmounts,
			blessingManager.getPoolAmount(),
			blessingManager.getPoolThreshold()
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{ allowedPlayerKeycloakIds: [player.keycloakId] },
			getEndCallback(player, context)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT)
			.build();

		response.push(packet);
	}
};
