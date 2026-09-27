import {
	CommandMapDisplayRes, CommandMapPacketReq
} from "../../../../Lib/src/packets/commands/CommandMapPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import { MapLocation } from "../../data/MapLocation";
import { Language } from "../../../../Lib/src/Language";
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Maps } from "../../core/maps/Maps";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { CityDataController } from "../../data/City";

type MapImage = {
	name: string;
	fallback?: string;
	forced: boolean;
};

function destinationImage(destination: MapLocation, language: Language): MapImage {
	return {
		name: `${language}_${destination.id}_`,
		fallback: `en_${destination.id}_`,
		forced: false
	};
}

function arrivedImage(mapLink: MapLink, departure: MapLocation, destination: MapLocation, language: Language): MapImage {
	return {
		name: mapLink.forcedImage && departure.attribute === MapConstants.MAP_ATTRIBUTES.HAUNTED
			? `${mapLink.forcedImage}_${language}`
			: `${language}_${destination.id}_`,

		fallback: mapLink.forcedImage ? undefined : `en_${destination.id}_`,
		forced: Boolean(destination.forcedImage)
	};
}

function roadImage(mapLink: MapLink, departure: MapLocation, destination: MapLocation, language: Language): MapImage {
	if (mapLink.forcedImage) {
		return {
			name: departure.attribute === MapConstants.MAP_ATTRIBUTES.HAUNTED ? `${mapLink.forcedImage}_${language}` : mapLink.forcedImage,
			forced: true
		};
	}

	// The road out of the reception room has no picture of its own: it shows where it leads.
	if (departure.id === MapConstants.LOCATIONS_IDS.RECEPTION_ROOM) {
		return destinationImage(destination, language);
	}

	const [first, second] = destination.id < departure.id ? [destination.id, departure.id] : [departure.id, destination.id];
	return {
		name: `${language}_${first}_${second}_`,
		fallback: `en_${first}_${second}_`,
		forced: false
	};
}

/**
 * Get the map information for the player
 * @param player
 * @param destination
 * @param hasArrived
 * @param language
 */
function getMapInformation(player: Player, destination: MapLocation, hasArrived: boolean, language: Language): MapImage {
	const mapLink = MapLinkDataController.instance.getById(player.mapLinkId);
	if (!mapLink) {
		return destinationImage(destination, language);
	}
	const departure = player.getPreviousMap()!;
	return hasArrived ? arrivedImage(mapLink, departure, destination, language) : roadImage(mapLink, departure, destination, language);
}

export class MapCommand {
	@commandRequires(CommandMapPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandMapPacketReq): Promise<void> {
		const hasArrived = Maps.isArrived(player, new Date());
		const destinationMap = player.getDestination()!;

		const mapInformation = getMapInformation(player, destinationMap, hasArrived, packet.language);

		response.push(makePacket(CommandMapDisplayRes, {
			cities: CityDataController.instance.getAllValues().filter(city => city.maps.length > 0)
				.map(city => ({
					id: city.id, mapLocationId: city.maps[0], services: city.services, shops: city.shops ?? []
				})),
			mapId: destinationMap.id,
			mapLink: mapInformation,
			mapType: destinationMap.type,
			hasArrived
		}));

		await MissionsController.update(player, response, { missionId: "commandMap" });
	}
}
