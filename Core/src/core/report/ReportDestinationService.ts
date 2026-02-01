import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportChooseDestinationRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../database/game/models/Player";
import { Maps } from "../maps/Maps";
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import {
	ReactionCollectorChooseDestination,
	ReactionCollectorChooseDestinationReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import { MapCache } from "../maps/MapCache";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Build map reaction data for destination choices
 */
function buildMapReaction(
	player: Player,
	mapId: number
): ReactionCollectorChooseDestinationReaction {
	const mapLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId);
	if (!mapLink) {
		throw new Error(`No map link found between ${player.getDestinationId()} and ${mapId}`);
	}
	const mapLocation = MapLocationDataController.instance.getById(mapId);
	if (!mapLocation) {
		throw new Error(`No map location found for mapId ${mapId}`);
	}
	const mapTypeId = mapLocation.type;
	const isPveMap = MapCache.allPveMapLinks.includes(mapLink.id);

	return {
		mapId,
		mapTypeId,
		tripDuration: isPveMap || RandomUtils.crowniclesRandom.bool() ? mapLink.tripDuration : undefined,
		enterInCity: mapLocation.cityId !== null
	};
}

/**
 * Handle the player's destination choice
 */
function createDestinationEndCallback(player: Player): EndCallback {
	return async (collector, response) => {
		const firstReaction = collector.getFirstReaction();

		const mapId = firstReaction
			? (firstReaction.reaction.data as ReactionCollectorChooseDestinationReaction).mapId
			: (RandomUtils.crowniclesRandom.pick(collector.creationPacket.reactions).data as ReactionCollectorChooseDestinationReaction).mapId;

		const newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId);
		if (!newLink) {
			throw new Error(`No map link found between ${player.getDestinationId()} and ${mapId}`);
		}
		const endMap = MapLocationDataController.instance.getById(mapId);
		if (!endMap) {
			throw new Error(`No map location found for mapId ${mapId}`);
		}

		await Maps.startTravel(player, newLink, Date.now());

		response.push(makePacket(CommandReportChooseDestinationRes, {
			mapId: newLink.endMap,
			mapTypeId: endMap.type,
			tripDuration: newLink.tripDuration
		}));

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION);
	};
}

/**
 * Automatically chooses a destination at random / based on the forced link
 */
async function automaticChooseDestination(
	forcedLink: MapLink | null,
	player: Player,
	destinationMaps: number[],
	response: CrowniclesPacket[]
): Promise<void> {
	let newLink: MapLink | undefined;
	if (forcedLink && forcedLink.id !== -1) {
		newLink = forcedLink;
	}
	else {
		newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, destinationMaps[0]);
	}
	if (!newLink) {
		throw new Error(`No map link found for automatic destination from ${player.getDestinationId()} to ${destinationMaps[0]}`);
	}

	const endMap = MapLocationDataController.instance.getById(newLink.endMap);
	if (!endMap) {
		throw new Error(`No map location found for mapId ${newLink.endMap}`);
	}
	await Maps.startTravel(player, newLink, Date.now());

	response.push(makePacket(CommandReportChooseDestinationRes, {
		mapId: newLink.endMap,
		mapTypeId: endMap.type,
		tripDuration: newLink.tripDuration
	}));
}

/**
 * Check if automatic destination choice should be made
 */
function shouldAutoChooseDestination(
	player: Player,
	destinationMaps: number[],
	forcedLink: MapLink | null
): boolean {
	const notOnPveOrSingleChoice = !Maps.isOnPveIsland(player) || destinationMaps.length === 1;
	const hasForcedOrSingleNonBeginning = Boolean(forcedLink) || (destinationMaps.length === 1 && player.mapLinkId !== Constants.BEGINNING.LAST_MAP_LINK);

	return notOnPveOrSingleChoice && hasForcedOrSingleNonBeginning;
}

/**
 * Sends a message so that the player can choose where to go
 */
export async function chooseDestination(
	context: PacketContext,
	player: Player,
	forcedLink: MapLink | null,
	response: CrowniclesPacket[],
	mainPacket = true
): Promise<void> {
	await PlayerSmallEvents.removeSmallEventsOfPlayer(player.id);
	const destinationMaps = Maps.getNextPlayerAvailableMaps(player);

	if (destinationMaps.length === 0) {
		CrowniclesLogger.error(`Player ${player.id} hasn't any destination map (current map: ${player.getDestinationId()})`);
		return;
	}

	if (shouldAutoChooseDestination(player, destinationMaps, forcedLink)) {
		await automaticChooseDestination(forcedLink, player, destinationMaps, response);
		return;
	}

	const mapReactions = destinationMaps.map(mapId => buildMapReaction(player, mapId));
	const collector = new ReactionCollectorChooseDestination(mapReactions);
	const endCallback = createDestinationEndCallback(player);

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			mainPacket,
			time: Math.min(Constants.MESSAGES.COLLECTOR_TIME, player.effectRemainingTime() || Constants.MESSAGES.COLLECTOR_TIME)
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION)
		.build();

	response.push(packet);
}
