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
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventAltarPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

/**
 * Calculate the 3 contribution amounts for a given player
 */
function getContributionAmounts(player: Player): number[] {
	return [
		BlessingConstants.FLAT_CONTRIBUTION,
		Math.max(1, Math.floor(player.money * BlessingConstants.MONEY_PERCENTAGE_CONTRIBUTION)),
		Math.max(1, player.level * BlessingConstants.LEVEL_MULTIPLIER_CONTRIBUTION)
	];
}

function getEndCallback(player: Player): EndCallback {
	return async (collector, response) => {
		const reaction = collector.getFirstReaction();
		const blessingManager = BlessingManager.getInstance();

		if (!reaction || reaction.reaction.type !== ReactionCollectorAltarContributeReaction.name) {
			// Player refused or timeout
			response.push(makePacket(SmallEventAltarPacket, {
				contributed: false,
				amount: 0,
				blessingTriggered: false,
				blessingType: 0,
				newPoolAmount: blessingManager.getPoolAmount(),
				poolThreshold: blessingManager.getPoolThreshold(),
				hasEnoughMoney: true
			}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT);
			return;
		}

		const chosenAmount = (reaction.reaction.data as ReactionCollectorAltarContributeReaction).amount;

		// Check if player has enough money
		if (player.money < chosenAmount) {
			response.push(makePacket(SmallEventAltarPacket, {
				contributed: false,
				amount: chosenAmount,
				blessingTriggered: false,
				blessingType: 0,
				newPoolAmount: blessingManager.getPoolAmount(),
				poolThreshold: blessingManager.getPoolThreshold(),
				hasEnoughMoney: false
			}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT);
			return;
		}

		// Spend money
		await player.spendMoney({
			amount: chosenAmount,
			response,
			reason: NumberChangeReason.BLESSING
		});

		// Contribute to pool
		const blessingTriggered = await blessingManager.contribute(chosenAmount, player.keycloakId, response);

		response.push(makePacket(SmallEventAltarPacket, {
			contributed: true,
			amount: chosenAmount,
			blessingTriggered,
			blessingType: blessingTriggered ? blessingManager.getActiveBlessingType() : 0,
			newPoolAmount: blessingManager.getPoolAmount(),
			poolThreshold: blessingManager.getPoolThreshold(),
			hasEnoughMoney: true
		}));

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT);
		await player.save();
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: (): boolean => {
		const blessingManager = BlessingManager.getInstance();
		return blessingManager.canOracleAppear();
	},
	executeSmallEvent: (response, player, context): void => {
		const blessingManager = BlessingManager.getInstance();
		const contributionAmounts = getContributionAmounts(player);

		const collector = new ReactionCollectorAltar(
			contributionAmounts,
			blessingManager.getPoolAmount(),
			blessingManager.getPoolThreshold()
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{ allowedPlayerKeycloakIds: [player.keycloakId] },
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.ALTAR_SMALL_EVENT)
			.build();

		response.push(packet);
	}
};
