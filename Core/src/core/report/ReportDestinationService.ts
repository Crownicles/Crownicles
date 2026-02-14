import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportChooseDestinationCityRes,
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
import { CityDataController } from "../../data/City";

/**
 * Add the appropriate destination response packet (city or regular) to the response
 */
function addDestinationResToResponse(
	response: CrowniclesPacket[],
	mapLink: MapLink,
	mapTypeId: string,
	tripDuration: number
): void {
	if (CityDataController.instance.getCityByMapLinkId(mapLink.id)) {
		response.push(makePacket(CommandReportChooseDestinationCityRes, {
			mapId: mapLink.endMap,
			mapTypeId
		}));
	}
	else {
		response.push(makePacket(CommandReportChooseDestinationRes, {
			mapId: mapLink.endMap,
			mapTypeId,
			tripDuration
		}));
	}
}

/**
 * Automatically chooses a destination at random / based on the forced link
 */
async function automaticChooseDestination(forcedLink: MapLink | null, player: Player, destinationMaps: number[], response: CrowniclesPacket[]): Promise<void> {
	let newLink: MapLink | undefined;
	if (forcedLink && forcedLink.id !== -1) {
		newLink = forcedLink;
	}
	else {
		newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, destinationMaps[0]);
	}
	if (!newLink) {
		CrowniclesLogger.error(`No map link found for automatic destination from ${player.getDestinationId()} to ${destinationMaps[0]}`);
		return;
	}
	const endMap = MapLocationDataController.instance.getById(newLink.endMap);
	if (!endMap) {
		CrowniclesLogger.error(`No map location found for mapId ${newLink.endMap}`);
		return;
	}
	await Maps.startTravel(player, newLink, Date.now());
	addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration ?? 0);
}

/**
 * Build the map reaction options for the destination collector
 */
function buildMapReactions(player: Player, destinationMaps: number[]): ReactionCollectorChooseDestinationReaction[] {
	return destinationMaps.map(mapId => {
		const mapLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId);
		const mapLocation = MapLocationDataController.instance.getById(mapId);
		if (!mapLink || !mapLocation) {
			throw new Error(`No map link or location found for destination ${player.getDestinationId()} -> ${mapId}`);
		}
		const isPveMap = MapCache.allPveMapLinks.includes(mapLink.id);

		return {
			mapId,
			mapTypeId: mapLocation.type,
			tripDuration: isPveMap || RandomUtils.crowniclesRandom.bool() ? mapLink.tripDuration : undefined,
			enterInCity: Boolean(CityDataController.instance.getCityByMapLinkId(mapLink.id))
		};
	});
}

/**
 * Create and send the destination choice collector to the player
 */
function sendDestinationCollector(
	context: PacketContext,
	player: Player,
	destinationMaps: number[],
	response: CrowniclesPacket[],
	mainPacket: boolean
): void {
	const mapReactions = buildMapReactions(player, destinationMaps);
	const collector = new ReactionCollectorChooseDestination(mapReactions);

	const endCallback: EndCallback = async (collector, response) => {
		const firstReaction = collector.getFirstReaction();
		const mapId = firstReaction
			? (firstReaction.reaction.data as ReactionCollectorChooseDestinationReaction).mapId
			: (RandomUtils.crowniclesRandom.pick(collector.creationPacket.reactions).data as ReactionCollectorChooseDestinationReaction).mapId;
		const newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId);
		const endMap = MapLocationDataController.instance.getById(mapId);
		if (!newLink || !endMap) {
			CrowniclesLogger.error(`No map link or location found for chosen destination ${player.getDestinationId()} -> ${mapId}`);
			return;
		}

		await Maps.startTravel(player, newLink, Date.now());

		addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration ?? 0);

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION);
	};

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

	const canAutoChoose = (!Maps.isOnPveIsland(player) || destinationMaps.length === 1)
		&& (forcedLink || (destinationMaps.length === 1 && player.mapLinkId !== Constants.BEGINNING.LAST_MAP_LINK));

	if (canAutoChoose) {
		await automaticChooseDestination(forcedLink, player, destinationMaps, response);
		return;
	}

	sendDestinationCollector(context, player, destinationMaps, response, mainPacket);
}
