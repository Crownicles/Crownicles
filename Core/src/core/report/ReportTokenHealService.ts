import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealRefusePacketRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../database/game/models/Player";
import { TravelTime } from "../maps/TravelTime";
import { Maps } from "../maps/Maps";
import { Effect } from "../../../../Lib/src/types/Effect";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorUseTokens } from "../../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import { ReactionCollectorBuyHeal } from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyHeal";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	calculateHealAlterationPrice,
	canHealAlteration,
	healAlterationAndAdvance
} from "../utils/HealAlterationUtils";
import {
	calculateTokenCost,
	canUseTokensAtLocation
} from "./ReportTravelService";
import {
	HEAL_VALIDATION_REASONS, HealValidationReason
} from "./ReportValidationConstants";

/**
 * Execute the token usage after confirmation
 */
async function acceptUseTokens(
	player: Player,
	tokenCost: number,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();

	// If player no longer has enough tokens, abort
	if (player.tokens < tokenCost) {
		return;
	}

	// Spend the tokens (use original cost for clarity to the user)
	await player.useTokens({
		amount: tokenCost,
		response,
		reason: NumberChangeReason.REPORT_TOKENS
	});

	// If player has occupied alteration, remove it
	if (player.effectId === Effect.OCCUPIED.id) {
		await TravelTime.removeEffect(player, NumberChangeReason.REPORT_TOKENS);
	}

	// Recalculate travel data AFTER removing the effect to get the correct next small event time
	const updatedDate = new Date();
	const updatedTimeData = await TravelTime.getTravelData(player, updatedDate);

	// Make the player time travel to the next small event
	await TravelTime.timeTravel(
		player,
		updatedTimeData.nextSmallEventTime - updatedDate.valueOf(),
		NumberChangeReason.REPORT_TOKENS,
		true
	);

	await player.save();

	// Check if player arrived at destination
	const newDate = new Date();
	const isArrived = Maps.isArrived(player, newDate);

	response.push(makePacket(CommandReportUseTokensAcceptPacketRes, {
		tokensSpent: tokenCost,
		isArrived
	}));
}

/**
 * Execute the heal purchase after confirmation
 */
async function acceptBuyHeal(
	player: Player,
	healPrice: number,
	response: CrowniclesPacket[]
): Promise<void> {
	await player.reload();
	const currentDate = new Date();

	// Check if player can be healed
	const healCheck = canHealAlteration(player, currentDate);
	if (!healCheck.canHeal) {
		if (healCheck.reason === HEAL_VALIDATION_REASONS.NO_ALTERATION) {
			response.push(makePacket(CommandReportBuyHealNoAlterationPacketRes, {}));
		}
		else if (healCheck.reason === HEAL_VALIDATION_REASONS.OCCUPIED) {
			response.push(makePacket(CommandReportBuyHealCannotHealOccupiedPacketRes, {}));
		}
		return;
	}

	// If player no longer has enough money, abort
	if (player.money < healPrice) {
		return;
	}

	// Spend the money (use original price for clarity to the user)
	await player.spendMoney({
		amount: healPrice,
		response,
		reason: NumberChangeReason.SHOP
	});

	// Heal and advance the player
	const isArrived = await healAlterationAndAdvance(player, currentDate, NumberChangeReason.SHOP, response);

	response.push(makePacket(CommandReportBuyHealAcceptPacketRes, {
		healPrice,
		isArrived
	}));
}

/**
 * Create the use tokens collector
 */
export function createUseTokensCollector(
	player: Player,
	tokenCost: number,
	context: PacketContext,
	response: CrowniclesPacket[]
): void {
	const collector = new ReactionCollectorUseTokens(tokenCost, player.tokens);

	const endCallback: EndCallback = async (collector, response) => {
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_USE_TOKENS);

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptUseTokens(player, tokenCost, response);
		}
		else {
			response.push(makePacket(CommandReportUseTokensRefusePacketRes, {}));
		}
	};

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1,
			mainPacket: false
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT_USE_TOKENS)
		.build();

	response.push(collectorPacket);
}

/**
 * Create the buy heal collector
 */
export function createBuyHealCollector(
	player: Player,
	healPrice: number,
	context: PacketContext,
	response: CrowniclesPacket[]
): void {
	const collector = new ReactionCollectorBuyHeal(healPrice, player.money);

	const endCallback: EndCallback = async (collector, response) => {
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_BUY_HEAL);

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptBuyHeal(player, healPrice, response);
		}
		else {
			response.push(makePacket(CommandReportBuyHealRefusePacketRes, {}));
		}
	};

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1,
			mainPacket: false
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT_BUY_HEAL)
		.build();

	response.push(collectorPacket);
}

/**
 * Valid token cost result
 */
interface ValidTokenCostResult {
	valid: true;
	tokenCost: number;
}

/**
 * Invalid token cost result
 */
interface InvalidTokenCostResult {
	valid: false;
}

/**
 * Validate and get token cost for use tokens request
 */
export function validateUseTokensRequest(
	player: Player,
	effectId: string,
	effectRemainingTime: number
): ValidTokenCostResult | InvalidTokenCostResult {
	// Check if the player can use tokens at their current location
	if (!canUseTokensAtLocation(player)) {
		return { valid: false };
	}

	const tokenCostResult = calculateTokenCost(effectId, effectRemainingTime);

	if (!tokenCostResult.canUseTokens) {
		return { valid: false };
	}

	if (player.tokens < tokenCostResult.cost) {
		return { valid: false };
	}

	return {
		valid: true,
		tokenCost: tokenCostResult.cost
	};
}

/**
 * Valid heal price result
 */
interface ValidHealPriceResult {
	valid: true;
	healPrice: number;
}

/**
 * Invalid heal price result
 */
interface InvalidHealPriceResult {
	valid: false;
	reason?: HealValidationReason;
}

/**
 * Validate buy heal request
 */
export function validateBuyHealRequest(
	player: Player,
	currentDate: Date
): ValidHealPriceResult | InvalidHealPriceResult {
	// Use shared validation logic
	const healCheck = canHealAlteration(player, currentDate);
	if (!healCheck.canHeal) {
		return {
			valid: false,
			reason: healCheck.reason
		};
	}

	const healPrice = calculateHealAlterationPrice(player);

	// Check if player has enough money
	if (player.money < healPrice) {
		return { valid: false };
	}

	return {
		valid: true,
		healPrice
	};
}
