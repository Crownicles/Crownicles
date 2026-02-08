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
async function automaticChooseDestination(forcedLink: MapLink, player: Player, destinationMaps: number[], response: CrowniclesPacket[]): Promise<void> {
	const newLink = forcedLink && forcedLink.id !== -1 ? forcedLink : MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, destinationMaps[0])!;
	const endMap = MapLocationDataController.instance.getById(newLink.endMap)!;
	await Maps.startTravel(player, newLink, Date.now());
	addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration!);
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

	if ((!Maps.isOnPveIsland(player) || destinationMaps.length === 1)
		&& (forcedLink || destinationMaps.length === 1 && player.mapLinkId !== Constants.BEGINNING.LAST_MAP_LINK)
	) {
		await automaticChooseDestination(forcedLink!, player, destinationMaps, response);
		return;
	}

	const mapReactions: ReactionCollectorChooseDestinationReaction[] = destinationMaps.map(mapId => {
		const mapLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId)!;
		const mapTypeId = MapLocationDataController.instance.getById(mapId)!.type;
		const isPveMap = MapCache.allPveMapLinks.includes(mapLink.id);

		return {
			mapId,
			mapTypeId,
			tripDuration: isPveMap || RandomUtils.crowniclesRandom.bool() ? mapLink.tripDuration! : undefined,
			enterInCity: Boolean(CityDataController.instance.getCityByMapLinkId(mapLink.id))
		};
	});

	const collector = new ReactionCollectorChooseDestination(mapReactions);

	const endCallback: EndCallback = async (collector, response) => {
		const firstReaction = collector.getFirstReaction();
		const mapId = firstReaction
			? (firstReaction.reaction.data as ReactionCollectorChooseDestinationReaction).mapId
			: (RandomUtils.crowniclesRandom.pick(collector.creationPacket.reactions).data as ReactionCollectorChooseDestinationReaction).mapId;
		const newLink = MapLinkDataController.instance.getLinkByLocations(player.getDestinationId()!, mapId)!;
		const endMap = MapLocationDataController.instance.getById(mapId)!;

		await Maps.startTravel(player, newLink, Date.now());

		addDestinationResToResponse(response, newLink, endMap.type, newLink.tripDuration!);

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
