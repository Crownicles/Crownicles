import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportChooseDestinationRes,
	CommandReportStayInCity
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
	ReactionCollectorChooseDestinationReaction,
	ReactionCollectorStayInCityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import { MapCache } from "../maps/MapCache";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { PlayersConstants } from "../../../../Lib/src/constants/PlayersConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { CityDataController } from "../../data/City";
import { withLockedPlayerSafe } from "../utils/withLockedPlayerSafe";

/**
 * Add the appropriate destination response packet (city or regular) to the response
 */
function addDestinationResToResponse(
	response: CrowniclesPacket[],
	mapLink: MapLink,
	mapTypeId: string,
	tripDuration: number
): void {
	response.push(makePacket(CommandReportChooseDestinationRes, {
		mapId: mapLink.endMap,
		mapTypeId,
		tripDuration
	}));
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
			tripDuration: isPveMap || RandomUtils.crowniclesRandom.bool() ? mapLink.tripDuration : undefined
		};
	});
}

/**
 * Persist the "stay in city" choice: the player defers the destination choice and
 * will be shown the city menu on the next reports until they explicitly leave.
 */
async function applyStayInCity(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await withLockedPlayerSafe(player, "chooseDestination.stayInCity", async lockedPlayer => {
		lockedPlayer.insideCity = true;

		// Become stationary on the city map location: no active travel left on the map link.
		lockedPlayer.startTravelDate = new Date(PlayersConstants.PLAYER_DEFAULT_VALUES.START_TRAVEL_DATE);
		await lockedPlayer.save();
	});
	response.push(makePacket(CommandReportStayInCity, {}));
}

/**
 * Create and send the destination choice collector to the player
 */
function sendDestinationCollector(
	context: PacketContext,
	player: Player,
	destinationMaps: number[],
	response: CrowniclesPacket[],
	mainPacket: boolean,
	stayInCityAllowed: boolean
): void {
	const mapReactions = buildMapReactions(player, destinationMaps);
	const collector = new ReactionCollectorChooseDestination(mapReactions, stayInCityAllowed);

	const endCallback: EndCallback = async (collector, response) => {
		const firstReaction = collector.getFirstReaction();

		// Doing nothing (timeout) or explicitly choosing it defaults to staying in the city when that option is offered.
		const staysInCity = stayInCityAllowed
			&& (!firstReaction || firstReaction.reaction.type === ReactionCollectorStayInCityReaction.name);
		if (staysInCity) {
			await applyStayInCity(player, response);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CHOOSE_DESTINATION);
			return;
		}

		const mapId = firstReaction
			? (firstReaction.reaction.data as ReactionCollectorChooseDestinationReaction).mapId
			: RandomUtils.crowniclesRandom.pick(mapReactions).mapId;
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
 * Whether the player can defer the destination choice and stay in the city.
 * Only possible when standing on a city map location and not forcibly teleported.
 */
export function canStayInCity(player: Player, forcedLink: MapLink | null, allowStayInCity: boolean): boolean {
	return allowStayInCity
		&& !forcedLink
		&& Boolean(CityDataController.instance.getCityByMapId(player.getDestinationId()!));
}

/**
 * Whether the player must stay in the city directly, skipping the destination menu.
 * Only when the outcome requests it, the player is on a city and is not forcibly teleported.
 */
export function mustForceStayInCity(player: Player, forcedLink: MapLink | null, forceStayInCity: boolean): boolean {
	return forceStayInCity
		&& !forcedLink
		&& Boolean(CityDataController.instance.getCityByMapId(player.getDestinationId()!));
}

/**
 * Whether the destination can be chosen automatically (no collector shown to the player).
 */
export function canAutoChooseDestination(player: Player, forcedLink: MapLink | null, destinationMaps: number[], stayInCityAllowed: boolean): boolean {
	return !stayInCityAllowed
		&& (!Maps.isOnPveIsland(player) || destinationMaps.length === 1)
		&& Boolean(forcedLink || (destinationMaps.length === 1 && player.mapLinkId !== Constants.BEGINNING.LAST_MAP_LINK));
}

/**
 * Sends a message so that the player can choose where to go
 */
export async function chooseDestination(
	context: PacketContext,
	player: Player,
	forcedLink: MapLink | null,
	response: CrowniclesPacket[],
	options: {
		mainPacket?: boolean;
		allowStayInCity?: boolean;
		forceStayInCity?: boolean;
	} = {}
): Promise<void> {
	const {
		mainPacket = true, allowStayInCity = true, forceStayInCity = false
	} = options;
	await PlayerSmallEvents.removeSmallEventsOfPlayer(player.id);

	// The outcome text already committed the player to staying in the city: enter it directly without the destination menu.
	if (mustForceStayInCity(player, forcedLink, forceStayInCity)) {
		await applyStayInCity(player, response);
		return;
	}

	const destinationMaps = Maps.getNextPlayerAvailableMaps(player);

	if (destinationMaps.length === 0) {
		CrowniclesLogger.error(`Player ${player.id} hasn't any destination map (current map: ${player.getDestinationId()})`);
		return;
	}

	const stayInCityAllowed = canStayInCity(player, forcedLink, allowStayInCity);

	if (canAutoChooseDestination(player, forcedLink, destinationMaps, stayInCityAllowed)) {
		await automaticChooseDestination(forcedLink, player, destinationMaps, response);
		return;
	}

	sendDestinationCollector(context, player, destinationMaps, response, mainPacket, stayInCityAllowed);
}
