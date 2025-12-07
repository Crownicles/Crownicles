import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportTravelSummaryRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../database/game/models/Player";
import { TravelTime } from "../maps/TravelTime";
import { Maps } from "../maps/Maps";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { Effect } from "../../../../Lib/src/types/Effect";
import { calculateHealAlterationPrice } from "../utils/HealAlterationUtils";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { millisecondsToMinutes } from "../../../../Lib/src/utils/TimeUtils";

/**
 * Token cost calculation result
 */
export interface TokenCostResult {
	cost: number;
	canUseTokens: true;
}

/**
 * Result indicating tokens cannot be used
 */
export interface TokenCostUnavailable {
	canUseTokens: false;
}

/**
 * Calculate the token cost for advancing using tokens
 * @param effectId - The current effect of the player
 * @param effectRemainingTime - The remaining time of the effect in milliseconds
 */
export function calculateTokenCost(effectId: string, effectRemainingTime: number): TokenCostResult | TokenCostUnavailable {
	// If player has an alteration other than occupied or no_effect, tokens cannot be used
	if (effectId !== Effect.NO_EFFECT.id && effectId !== Effect.OCCUPIED.id) {
		return { canUseTokens: false };
	}

	// Base cost is 1 token
	let cost = TokensConstants.REPORT.BASE_COST;

	// If occupied, add 1 token per 20 minutes of remaining time
	if (effectId === Effect.OCCUPIED.id) {
		const remainingMinutes = millisecondsToMinutes(effectRemainingTime);
		cost += Math.ceil(remainingMinutes / TokensConstants.REPORT.MINUTES_PER_ADDITIONAL_TOKEN);
	}

	// Cap the cost at the maximum
	return {
		canUseTokens: true,
		cost: Math.min(cost, TokensConstants.REPORT.MAX_COST)
	};
}

/**
 * Travel summary data structure
 */
interface TravelSummaryData {
	effect: string | null;
	startTime: number;
	arriveTime: number;
	effectEndTime: number | null;
	effectDuration: number;
	nextSmallEventTime: number;
	lastSmallEventId: string | null;
	isOnBoat: boolean;
}

/**
 * Build travel summary data from player state
 */
async function buildTravelSummaryData(player: Player, date: Date, effectId: string | null): Promise<TravelSummaryData> {
	const timeData = await TravelTime.getTravelData(player, date);
	const lastMiniEvent = await PlayerSmallEvents.getLastOfPlayer(player.id);

	return {
		effect: effectId,
		startTime: timeData.travelStartTime,
		arriveTime: timeData.travelEndTime,
		effectEndTime: effectId ? timeData.effectEndTime : null,
		effectDuration: timeData.effectDuration,
		nextSmallEventTime: timeData.nextSmallEventTime,
		lastSmallEventId: lastMiniEvent ? lastMiniEvent.eventType : null,
		isOnBoat: Maps.isOnBoat(player)
	};
}

/**
 * Energy display data
 */
interface EnergyDisplayData {
	show: boolean;
	current: number;
	max: number;
}

/**
 * Build energy display data
 */
function buildEnergyData(player: Player, showEnergy: boolean): EnergyDisplayData {
	return {
		show: showEnergy,
		current: showEnergy ? player.getCumulativeEnergy() : 0,
		max: showEnergy ? player.getMaxCumulativeEnergy() : 0
	};
}

/**
 * Points display data
 */
interface PointsDisplayData {
	show: boolean;
	cumulated: number;
}

/**
 * Build points display data
 */
async function buildPointsData(player: Player, showEnergy: boolean): Promise<PointsDisplayData> {
	return {
		show: !showEnergy,
		cumulated: !showEnergy ? await PlayerSmallEvents.calculateCurrentScore(player) : 0
	};
}

/**
 * Token button data
 */
interface TokenButtonData {
	cost: number;
	playerTokens: number;
}

/**
 * Check if the player can use tokens at their current location
 * Tokens can only be used on the main continent (not on boat, not on PVE island, and tutorial completed)
 * @param player - The player to check
 */
export function canUseTokensAtLocation(player: Player): boolean {
	// Tokens are unlocked at a specific level
	if (player.level < TokensConstants.LEVEL_TO_UNLOCK) {
		return false;
	}

	// Tokens can only be used on the main continent
	if (!Maps.isOnContinent(player)) {
		return false;
	}

	// Tokens cannot be used on the boat
	if (Maps.isOnBoat(player)) {
		return false;
	}

	// Tokens cannot be used on the PVE island
	if (Maps.isOnPveIsland(player)) {
		return false;
	}

	return true;
}

/**
 * Build token button data if applicable
 */
function buildTokenData(
	tokenCostResult: TokenCostResult | TokenCostUnavailable,
	player: Player
): TokenButtonData | undefined {
	if (!tokenCostResult.canUseTokens) {
		return undefined;
	}

	// Check if the player can use tokens at their current location
	if (!canUseTokensAtLocation(player)) {
		return undefined;
	}

	return {
		cost: tokenCostResult.cost,
		playerTokens: player.tokens
	};
}

/**
 * Heal button data
 */
interface HealButtonData {
	price: number;
	playerMoney: number;
}

/**
 * Build heal button data if applicable
 */
function buildHealData(
	player: Player,
	effectId: string | null
): HealButtonData | undefined {
	if (!effectId || effectId === Effect.OCCUPIED.id) {
		return undefined;
	}
	return {
		price: calculateHealAlterationPrice(player),
		playerMoney: player.money
	};
}

/**
 * Send the location where the player is currently staying on the road
 */
export async function sendTravelPath(
	player: Player,
	response: CrowniclesPacket[],
	date: Date,
	effectId: string | null
): Promise<void> {
	const timeData = await TravelTime.getTravelData(player, date);
	const showEnergy = Maps.isOnPveIsland(player) || Maps.isOnBoat(player);

	const travelSummaryData = await buildTravelSummaryData(player, date, effectId);
	const endMap = player.getDestination();
	const startMap = player.getPreviousMap();

	// Calculate token cost
	const tokenCostResult = calculateTokenCost(effectId ?? Effect.NO_EFFECT.id, timeData.effectRemainingTime);

	response.push(makePacket(CommandReportTravelSummaryRes, {
		effect: travelSummaryData.effect,
		startTime: travelSummaryData.startTime,
		arriveTime: travelSummaryData.arriveTime,
		effectEndTime: travelSummaryData.effectEndTime,
		effectDuration: travelSummaryData.effectDuration,
		points: await buildPointsData(player, showEnergy),
		energy: buildEnergyData(player, showEnergy),
		endMap: {
			id: endMap.id,
			type: endMap.type
		},
		nextStopTime: travelSummaryData.nextSmallEventTime,
		lastSmallEventId: travelSummaryData.lastSmallEventId,
		startMap: {
			id: startMap.id,
			type: startMap.type
		},
		isOnBoat: travelSummaryData.isOnBoat,
		tokens: buildTokenData(tokenCostResult, player),
		heal: buildHealData(player, effectId)
	}));
}
