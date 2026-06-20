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
import { PossibilityEntry } from "../../data/events/Possibility";
import {
	applyPossibilityOutcome,
	PossibilityOutcomeEntry
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
import { crowniclesInstance } from "../../app";
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
 * Whether the given (event, possibility) pair corresponds to the
 * "end" choice on the very first big event (the tutorial entry point).
 */
function isFirstReportEndChoice(event: BigEvent, possibility: PossibilityEntry): boolean {
	return event.id === ReportConstants.FIRST_BIG_EVENT_ID && possibility[0] === ReportConstants.END_POSSIBILITY_ID;
}

/**
 * Special-case the "end" choice on the very first report (event id 0):
 * we want to log + acknowledge it but skip the full outcome pipeline.
 */
function handleFirstReportEnd(event: BigEvent, possibility: PossibilityEntry, freshPlayer: Player, response: CrowniclesPacket[]): void {
	crowniclesInstance?.logsDatabase.logBigEvent(freshPlayer.keycloakId, event.id, possibility[0], "0")
		.then();
	response.push(makePacket(CommandReportBigEventResultRes, {
		...ReportConstants.EMPTY_BIG_EVENT_RESULT,
		eventId: event.id,
		possibilityId: possibility[0]
	}));
}

/**
 * Pick a random outcome among the ones whose condition passes for the
 * given player. Pure read of game data — safe outside the lock.
 */
async function pickRandomOutcome(possibility: PossibilityEntry, freshPlayer: Player): Promise<PossibilityOutcomeEntry> {
	const validOutcomes: PossibilityOutcomeEntry[] = [];
	for (const [key, outcome] of Object.entries(possibility[1].outcomes)) {
		if (!outcome.condition || await verifyPossibilityOutcomeCondition(outcome.condition, freshPlayer)) {
			validOutcomes.push([key, outcome]);
		}
	}
	return RandomUtils.crowniclesRandom.pick(validOutcomes);
}

/**
 * Update all the mission ids the outcome / possibility / event are tagged with.
 */
async function updateTagMissions(
	lockedPlayer: Player,
	response: CrowniclesPacket[],
	event: BigEvent,
	possibility: PossibilityEntry,
	randomOutcome: PossibilityOutcomeEntry
): Promise<void> {
	const tagsToVerify = (randomOutcome[1].tags ?? [])
		.concat(possibility[1].tags ?? [])
		.concat(event.tags ?? []);
	for (const tag of tagsToVerify) {
		await MissionsController.update(lockedPlayer, response, {
			missionId: tag,
			params: { tags: tagsToVerify }
		});
	}
}

/**
 * Body of the critical section: apply the outcome, persist the player,
 * log only after the row is durably saved. Runs under
 * `withLockedEntities([Player, PlayerMissionsInfo])`.
 */
async function applyLockedOutcomeUnderLock(
	lockedPlayer: Player,
	outcomeContext: {
		event: BigEvent;
		possibility: PossibilityEntry;
		randomOutcome: PossibilityOutcomeEntry;
		time: number;
	},
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const {
		event, possibility, randomOutcome, time
	} = outcomeContext;
	lockedPlayer.nextEvent = null;

	const newMapLink = await applyPossibilityOutcome({
		eventId: event.id,
		possibilityName: possibility[0],
		outcome: randomOutcome,
		time
	}, lockedPlayer, context, response);

	const isDead = await lockedPlayer.killIfNeeded(response, NumberChangeReason.BIG_EVENT);

	/*
	 * If the player is dead but a forced map link is provided, teleport them there.
	 * Otherwise, only choose destination if player is alive.
	 */
	if (newMapLink || !isDead) {
		await chooseDestination(context, lockedPlayer, newMapLink, response, {
			mainPacket: false,
			forceStayInCity: randomOutcome[1].forceStayInCity ?? false
		});
	}

	await MissionsController.update(lockedPlayer, response, { missionId: "doReports" });
	await updateTagMissions(lockedPlayer, response, event, possibility, randomOutcome);

	await lockedPlayer.save();

	// Log only after the outcome is durably persisted (#3760).
	crowniclesInstance?.logsDatabase.logBigEvent(lockedPlayer.keycloakId, event.id, possibility[0], randomOutcome[0])
		.then();
}

/**
 * Fallback when the locked row vanished between read and lock: drop the
 * outcome but keep the Discord UI responsive by pushing the next
 * destination packet (#3760).
 */
async function handleLockLost(freshPlayer: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	CrowniclesLogger.warn(
		`doPossibility: locked row vanished for player ${freshPlayer.id} — skipping possibility outcome and advancing player to next destination`
	);
	try {
		const fallbackPlayer = await Players.getById(freshPlayer.id);
		await chooseDestination(context, fallbackPlayer, null, response, { mainPacket: false });
	}
	catch (fallbackError) {
		CrowniclesLogger.warn(
			`doPossibility: fallback chooseDestination failed for player ${freshPlayer.id}: ${(fallbackError as Error).message}`
		);
	}
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
	possibility: PossibilityEntry,
	player: Player,
	time: number,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const freshPlayer = await Players.getOrRegister(player.keycloakId);

	if (isFirstReportEndChoice(event, possibility)) {
		handleFirstReportEnd(event, possibility, freshPlayer, response);
		BlockingUtils.unblockPlayer(freshPlayer.keycloakId, BlockingConstants.REASONS.REPORT);
		return;
	}

	const randomOutcome = await pickRandomOutcome(possibility, freshPlayer);

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
				await applyLockedOutcomeUnderLock(
					lockedPlayer,
					{
						event, possibility, randomOutcome, time
					},
					context,
					response
				);
			}
		);
	}
	catch (e) {
		if (!(e instanceof LockedRowNotFoundError)) {
			throw e;
		}
		await handleLockLost(freshPlayer, context, response);
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
