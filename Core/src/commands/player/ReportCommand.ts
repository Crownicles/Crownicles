import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealPacketReq,
	CommandReportPacketReq,
	CommandReportUseTokensPacketReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../../core/database/game/models/Player";
import { Maps } from "../../core/maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { getTimeFromXHoursAgo } from "../../../../Lib/src/utils/TimeUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { TravelTime } from "../../core/maps/TravelTime";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	HEAL_VALIDATION_REASONS
} from "../../core/report/ReportValidationConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";

// Import refactored services
import { sendTravelPath } from "../../core/report/ReportTravelService";
import { doPVEBoss } from "../../core/report/ReportPveService";
import { doRandomBigEvent } from "../../core/report/ReportBigEventService";
import { executeSmallEvent } from "../../core/report/ReportSmallEventService";
import { chooseDestination } from "../../core/report/ReportDestinationService";
import {
	createUseTokensCollector,
	createBuyHealCollector,
	validateUseTokensRequest,
	validateBuyHealRequest
} from "../../core/report/ReportTokenHealService";

/**
 * Initiates a new player on the map
 */
async function initiateNewPlayerOnTheAdventure(player: Player): Promise<void> {
	await Maps.startTravel(
		player,
		MapLinkDataController.instance.getById(Constants.BEGINNING.START_MAP_LINK),
		getTimeFromXHoursAgo(Constants.REPORT.HOURS_USED_TO_CALCULATE_FIRST_REPORT_REWARD).valueOf()
	);
	await player.save();
}

/**
 * Returns if the player reached a stopping point (= small event)
 */
async function needSmallEvent(player: Player, date: Date): Promise<boolean> {
	return (await TravelTime.getTravelData(player, date)).nextSmallEventTime <= date.valueOf();
}

/**
 * Check for missions that can be completed passively (without player action).
 * Currently checks:
 * - maxTokensReached: if tokens have passively reached max (e.g., from 3 free daily tokens)
 * @param player - The player whose passive missions to check
 * @param response - The response packets
 */
async function checkPassiveMissions(player: Player, response: CrowniclesPacket[]): Promise<void> {
	// Check if tokens are at max - mission may have been completed passively through daily free tokens
	if (player.level >= TokensConstants.LEVEL_TO_UNLOCK && player.tokens >= TokensConstants.MAX) {
		await MissionsController.update(player, response, { missionId: "maxTokensReached" });
	}
}

export default class ReportCommand {
	@commandRequires(CommandReportPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportPacketReq,
		context: PacketContext,
		forceSmallEvent: string | null = null,
		forceSpecificEvent = -1
	): Promise<void> {
		if (player.score === 0 && player.effectId === Effect.NOT_STARTED.id) {
			await initiateNewPlayerOnTheAdventure(player);
		}

		// Block player to prevent concurrent executions
		BlockingUtils.blockPlayer(
			player.keycloakId,
			BlockingConstants.REASONS.REPORT_COMMAND,
			Constants.MESSAGES.COLLECTOR_TIME * 3
		);

		await MissionsController.update(player, response, { missionId: "commandReport" });

		// Check for passively completable missions (e.g., tokens reaching max from daily free tokens)
		await checkPassiveMissions(player, response);

		const currentDate = new Date();

		if (player.effectId !== Effect.NO_EFFECT.id && player.currentEffectFinished(currentDate)) {
			await MissionsController.update(player, response, { missionId: "recoverAlteration" });
		}

		// Handle arrival at destination
		if (Maps.isArrived(player, currentDate)) {
			if (Maps.isOnPveIsland(player)) {
				await doPVEBoss(player, response, context, chooseDestination);
			}
			else {
				await doRandomBigEvent(context, response, player, chooseDestination, forceSpecificEvent);
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		// Handle small events
		if (forceSmallEvent || await needSmallEvent(player, currentDate)) {
			await executeSmallEvent(response, player, context, forceSmallEvent);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		// Handle active effect
		if (!player.currentEffectFinished(currentDate)) {
			await sendTravelPath(player, response, currentDate, player.effectId);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		// Handle no current travel
		if (!player.mapLinkId) {
			await Maps.startTravel(player, MapLinkDataController.instance.getRandomLinkOnMainContinent(), Date.now());
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		// Handle not travelling
		if (!Maps.isTravelling(player)) {
			await chooseDestination(context, player, null, response);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
			return;
		}

		// Default: show travel path
		await sendTravelPath(player, response, currentDate, null);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_COMMAND);
	}

	@commandRequires(CommandReportUseTokensPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async useTokens(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportUseTokensPacketReq,
		context: PacketContext
	): Promise<void> {
		const currentDate = new Date();
		const timeData = await TravelTime.getTravelData(player, currentDate);

		const validation = validateUseTokensRequest(player, player.effectId, timeData.effectRemainingTime);

		if (!validation.valid) {
			return;
		}

		createUseTokensCollector(player, validation.tokenCost, context, response);
	}

	@commandRequires(CommandReportBuyHealPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static buyHeal(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandReportBuyHealPacketReq,
		context: PacketContext
	): void {
		const currentDate = new Date();
		const validation = validateBuyHealRequest(player, currentDate);

		if (!validation.valid) {
			if ("reason" in validation && validation.reason === HEAL_VALIDATION_REASONS.NO_ALTERATION) {
				response.push(makePacket(CommandReportBuyHealNoAlterationPacketRes, {}));
			}
			else if ("reason" in validation && validation.reason === HEAL_VALIDATION_REASONS.OCCUPIED) {
				response.push(makePacket(CommandReportBuyHealCannotHealOccupiedPacketRes, {}));
			}
			return;
		}

		createBuyHealCollector(player, validation.healPrice, context, response);
	}
}
