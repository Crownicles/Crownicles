import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBigEventResultRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import { MissionsController } from "../missions/MissionsController";
import { MapLinkDataController } from "../../data/MapLink";
import {
	BigEvent, BigEventDataController
} from "../../data/BigEvent";
import { Possibility } from "../../data/events/Possibility";
import {
	applyPossibilityOutcome,
	PossibilityOutcome
} from "../../data/events/PossibilityOutcome";
import { verifyPossibilityOutcomeCondition } from "../../data/events/PossibilityOutcomeCondition";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import {
	ReactionCollectorBigEvent,
	ReactionCollectorBigEventPossibilityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { TravelTime } from "../maps/TravelTime";
import { Maps } from "../maps/Maps";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";
import { crowniclesInstance } from "../../index";
import {
	millisecondsToMinutes
} from "../../../../Lib/src/utils/TimeUtils";
import { chooseDestination } from "./ReportDestinationService";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Check all missions to check when you execute a big event
 * @param player
 * @param response
 */
export async function completeMissionsBigEvent(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await MissionsController.update(player, response, {
		missionId: "travelHours",
		params: {
			travelTime: player.getCurrentTripDuration()
		}
	});
	const endMapId = MapLinkDataController.instance.getById(player.mapLinkId)!.endMap;
	await MissionsController.update(player, response, {
		missionId: "goToPlace",
		params: { mapId: endMapId }
	});
	await MissionsController.update(player, response, {
		missionId: "exploreDifferentPlaces",
		params: { placeId: endMapId }
	});
	await MissionsController.update(player, response, {
		missionId: "fromPlaceToPlace",
		params: { mapId: endMapId }
	});
}

/**
 * @param event
 * @param possibility
 * @param player
 * @param time
 * @param context
 * @param response
 */
async function doPossibility(
	event: BigEvent,
	possibility: [string, Possibility],
	player: Player,
	time: number,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const freshPlayer = await Players.getOrRegister(player.keycloakId);

	if (event.id === 0 && possibility[0] === "end") { // Don't do anything if the player ends the first report
		crowniclesInstance?.logsDatabase.logBigEvent(freshPlayer.keycloakId, event.id, possibility[0], "0")
			.then();
		response.push(makePacket(CommandReportBigEventResultRes, {
			eventId: event.id,
			possibilityId: possibility[0],
			outcomeId: "0",
			oneshot: false,
			money: 0,
			energy: 0,
			gems: 0,
			experience: 0,
			health: 0,
			score: 0
		}));
		BlockingUtils.unblockPlayer(freshPlayer.keycloakId, BlockingConstants.REASONS.REPORT);
		return;
	}

	// Filter the outcomes that are valid (read-only, no DB writes — safe outside the lock)
	const entries = Object.entries(possibility[1].outcomes);

	const validOutcomes: [string, PossibilityOutcome][] = [];
	for (const [key, outcome] of entries) {
		if (!outcome.condition || await verifyPossibilityOutcomeCondition(outcome.condition, freshPlayer)) {
			validOutcomes.push([key, outcome]);
		}
	}

	const randomOutcome = RandomUtils.crowniclesRandom.pick(validOutcomes);

	/*
	 * Ensure the PlayerMissionsInfo row exists before we acquire the lock —
	 * `applyPossibilityOutcome` (via `applyOutcomeGems`) and the nested
	 * `MissionsController.update` calls both rely on this row, and a missing
	 * row would otherwise force an INSERT inside the locked transaction.
	 */
	await PlayerMissionsInfos.getOfPlayer(freshPlayer.id);

	try {
		await withLockedEntities(
			[
				Player.lockKey(freshPlayer.id),
				PlayerMissionsInfo.lockKey(freshPlayer.id)
			] as const,
			async ([lockedPlayer]) => {
				lockedPlayer.nextEvent = null;

				const newMapLink = await applyPossibilityOutcome({
					eventId: event.id,
					possibilityName: possibility[0],
					outcome: randomOutcome,
					time
				}, lockedPlayer, context, response);

				const isDead = await lockedPlayer.killIfNeeded(response, NumberChangeReason.BIG_EVENT);

				/*
				 * If the player is dead but a forced map link is provided, teleport them there
				 * Otherwise, only choose destination if player is alive
				 */
				if (newMapLink || !isDead) {
					await chooseDestination(context, lockedPlayer, newMapLink, response, false);
				}

				await MissionsController.update(lockedPlayer, response, { missionId: "doReports" });

				const tagsToVerify = (randomOutcome[1].tags ?? [])
					.concat(possibility[1].tags ?? [])
					.concat(event.tags ?? []);
				if (tagsToVerify.length > 0) {
					for (const tag of tagsToVerify) {
						await MissionsController.update(lockedPlayer, response, {
							missionId: tag,
							params: { tags: tagsToVerify }
						});
					}
				}

				await lockedPlayer.save();

				// Log only after the outcome is durably persisted (#3760).
				crowniclesInstance?.logsDatabase.logBigEvent(lockedPlayer.keycloakId, event.id, possibility[0], randomOutcome[0])
					.then();
			}
		);
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`doPossibility: locked row vanished for player ${freshPlayer.id} — skipping possibility outcome and advancing player to next destination`
			);

			/*
			 * Push a fallback response so the Discord UI does not hang to
			 * the collector timeout (#3760). We re-load the player and let
			 * `chooseDestination` emit the next destination packet — the
			 * outcome is dropped but the travel loop continues.
			 */
			try {
				const fallbackPlayer = await Players.getById(freshPlayer.id);
				await chooseDestination(context, fallbackPlayer, null, response, false);
			}
			catch (fallbackError) {
				CrowniclesLogger.warn(
					`doPossibility: fallback chooseDestination failed for player ${freshPlayer.id}: ${(fallbackError as Error).message}`
				);
			}
		}
		else {
			throw e;
		}
	}
	BlockingUtils.unblockPlayer(freshPlayer.keycloakId, BlockingConstants.REASONS.REPORT);
}

/**
 * @param event
 * @param player
 * @param time
 * @param context
 * @param response
 * @returns
 */
async function doEvent(event: BigEvent, player: Player, time: number, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	const possibilities = await event.getPossibilities(player);

	const collector = new ReactionCollectorBigEvent(
		event.id,
		possibilities.map(possibility => ({ name: possibility[0] }))
	);

	const endCallback: EndCallback = async (collector, response) => {
		const reaction = collector.getFirstReaction();

		if (!reaction) {
			await doPossibility(event, possibilities.find(possibility => possibility[0] === "end")!, player, time, context, response);
		}
		else {
			const reactionName = (reaction.reaction.data as ReactionCollectorBigEventPossibilityReaction).name;
			await doPossibility(event, possibilities.find(possibility => possibility[0] === reactionName)!, player, time, context, response);
		}
	};

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId]
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT)
		.build();

	response.push(packet);
}

/**
 * Do a random big event
 * @param context
 * @param response
 * @param player
 * @param forceSpecificEvent
 */
export async function doRandomBigEvent(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	forceSpecificEvent = -1
): Promise<void> {
	await completeMissionsBigEvent(player, response);
	const travelData = TravelTime.getTravelDataSimplified(player, new Date());
	let time = millisecondsToMinutes(travelData.playerTravelledTime);
	if (time > ReportConstants.TIME_LIMIT) {
		time = ReportConstants.TIME_LIMIT;
	}

	let event: BigEvent;

	// NextEvent is defined?
	if (player.nextEvent) {
		forceSpecificEvent = player.nextEvent;
	}

	if (forceSpecificEvent === -1 || !forceSpecificEvent) {
		const mapId = player.getDestinationId()!;
		const randomEvent = await BigEventDataController.instance.getRandomEvent(mapId, player);
		if (!randomEvent) {
			response.push(makePacket(ErrorPacket, { message: "It seems that there is no event here... It's a bug, please report it to the Crownicles staff." }));
			return;
		}
		event = randomEvent;
	}
	else {
		event = BigEventDataController.instance.getById(forceSpecificEvent)!;
	}
	await Maps.stopTravel(player);
	await doEvent(event, player, time, context, response);
}
