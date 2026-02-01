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
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
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
import { millisecondsToMinutes } from "../../../../Lib/src/utils/TimeUtils";

/**
 * ChooseDestination callback type
 */
type ChooseDestinationCallback = (
	context: PacketContext,
	player: Player,
	forcedLink: MapLink | null,
	response: CrowniclesPacket[],
	mainPacket?: boolean
) => Promise<void>;

/**
 * Check all missions to check when you execute a big event
 */
export async function completeMissionsBigEvent(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await MissionsController.update(player, response, {
		missionId: "travelHours",
		params: { travelTime: player.getCurrentTripDuration() }
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
 * Filter and get valid outcomes for a possibility
 */
async function getValidOutcomes(
	possibility: Possibility,
	player: Player
): Promise<[string, PossibilityOutcome][]> {
	const entries = Object.entries(possibility.outcomes);
	const validOutcomes: [string, PossibilityOutcome][] = [];

	for (const [key, outcome] of entries) {
		const isValid = !outcome.condition || await verifyPossibilityOutcomeCondition(outcome.condition, player);
		if (isValid) {
			validOutcomes.push([key, outcome]);
		}
	}

	return validOutcomes;
}

/**
 * Update missions based on tags from the outcome
 */
async function updateMissionsFromTags(
	player: Player,
	response: CrowniclesPacket[],
	outcome: PossibilityOutcome,
	possibility: Possibility,
	event: BigEvent
): Promise<void> {
	const tagsToVerify = (outcome.tags ?? [])
		.concat(possibility.tags ?? [])
		.concat(event.tags ?? []);

	if (!tagsToVerify.length) {
		return;
	}

	for (const tag of tagsToVerify) {
		await MissionsController.update(player, response, {
			missionId: tag,
			params: { tags: tagsToVerify }
		});
	}
}

/**
 * Handle the special case of first event end possibility
 */
function handleFirstEventEnd(
	event: BigEvent,
	possibilityName: string,
	player: Player,
	response: CrowniclesPacket[]
): boolean {
	if (event.id !== 0 || possibilityName !== "end") {
		return false;
	}

	crowniclesInstance?.logsDatabase.logBigEvent(player.keycloakId, event.id, possibilityName, "0").then();

	response.push(makePacket(CommandReportBigEventResultRes, {
		eventId: event.id,
		possibilityId: possibilityName,
		outcomeId: "0",
		oneshot: false,
		money: 0,
		energy: 0,
		gems: 0,
		experience: 0,
		health: 0,
		score: 0
	}));

	BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT);
	return true;
}

/**
 * Parameters for executing a possibility outcome
 */
interface DoPossibilityParams {
	event: BigEvent;
	possibility: [string, Possibility];
	player: Player;
	time: number;
	context: PacketContext;
	response: CrowniclesPacket[];
	chooseDestinationFn: ChooseDestinationCallback;
}

/**
 * Execute a possibility outcome
 */
async function doPossibility(params: DoPossibilityParams): Promise<void> {
	const {
		event, possibility, time, context, response, chooseDestinationFn
	} = params;
	let { player } = params;

	player = await Players.getOrRegister(player.keycloakId);
	player.nextEvent = 0;

	// Special case: first event end
	if (handleFirstEventEnd(event, possibility[0], player, response)) {
		return;
	}

	// Get valid outcomes
	const validOutcomes = await getValidOutcomes(possibility[1], player);
	const randomOutcome = RandomUtils.crowniclesRandom.pick(validOutcomes);

	crowniclesInstance?.logsDatabase.logBigEvent(player.keycloakId, event.id, possibility[0], randomOutcome[0]).then();

	const newMapLink = await applyPossibilityOutcome({
		eventId: event.id,
		possibilityName: possibility[0],
		outcome: randomOutcome,
		time
	}, player, context, response);

	const isDead = await player.killIfNeeded(response, NumberChangeReason.BIG_EVENT);

	// Choose destination if player is alive or has forced map link
	if (newMapLink || !isDead) {
		await chooseDestinationFn(context, player, newMapLink, response, false);
	}

	await MissionsController.update(player, response, { missionId: "doReports" });
	await updateMissionsFromTags(player, response, randomOutcome[1], possibility[1], event);

	await player.save();
	BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT);
}

/**
 * Create the end callback for big event collector
 */
function createBigEventEndCallback(
	event: BigEvent,
	possibilities: [string, Possibility][],
	player: Player,
	time: number,
	context: PacketContext,
	chooseDestinationFn: ChooseDestinationCallback
): EndCallback {
	return async (collector, response) => {
		const reaction = collector.getFirstReaction();

		const selectedPossibility = reaction
			? possibilities.find(p => p[0] === (reaction.reaction.data as ReactionCollectorBigEventPossibilityReaction).name)
			: possibilities.find(p => p[0] === "end");

		await doPossibility({
			event,
			possibility: selectedPossibility!,
			player,
			time,
			context,
			response,
			chooseDestinationFn
		});
	};
}

/**
 * Execute a big event
 */
async function doEvent(
	event: BigEvent,
	player: Player,
	time: number,
	context: PacketContext,
	response: CrowniclesPacket[],
	chooseDestinationFn: ChooseDestinationCallback
): Promise<void> {
	const possibilities = await event.getPossibilities(player);

	const collector = new ReactionCollectorBigEvent(
		event.id,
		possibilities.map(possibility => ({ name: possibility[0] }))
	);

	const endCallback = createBigEventEndCallback(event, possibilities, player, time, context, chooseDestinationFn);

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{ allowedPlayerKeycloakIds: [player.keycloakId] },
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT)
		.build();

	response.push(packet);
}

/**
 * Calculate capped travel time for event
 */
function calculateEventTime(player: Player): number {
	const travelData = TravelTime.getTravelDataSimplified(player, new Date());
	const time = millisecondsToMinutes(travelData.playerTravelledTime);
	return Math.min(time, ReportConstants.TIME_LIMIT);
}

/**
 * Do a random big event
 */
export async function doRandomBigEvent(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player,
	chooseDestinationFn: ChooseDestinationCallback,
	forceSpecificEvent = -1
): Promise<void> {
	await completeMissionsBigEvent(player, response);
	const time = calculateEventTime(player);

	let eventId = forceSpecificEvent;

	// NextEvent is defined?
	if (player.nextEvent) {
		eventId = player.nextEvent;
	}

	let event: BigEvent;

	if (eventId === -1 || !eventId) {
		const mapId = player.getDestinationId()!;
		const randomEvent = await BigEventDataController.instance.getRandomEvent(mapId, player);
		if (!randomEvent) {
			response.push(makePacket(ErrorPacket, {
				message: "It seems that there is no event here... It's a bug, please report it to the Crownicles staff."
			}));
			return;
		}
		event = randomEvent;
	}
	else {
		event = BigEventDataController.instance.getById(eventId)!;
	}

	await Maps.stopTravel(player);
	await doEvent(event, player, time, context, response, chooseDestinationFn);
}
