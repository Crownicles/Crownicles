import {
	CommandMapDisplayRes, CommandMapPacketReq
} from "../../../../Lib/src/packets/commands/CommandMapPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import { MapLocation } from "../../data/MapLocation";
import { Language } from "../../../../Lib/src/Language";
import { MapLinkDataController } from "../../data/MapLink";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { Maps } from "../../core/maps/Maps";

/**
 * Get the map information for the player
 * @param player
 * @param destination
 * @param hasArrived
 * @param language
 */
function getMapInformation(player: Player, destination: MapLocation, hasArrived: boolean, language: Language): {
	name: string;
	fallback?: string;
	forced: boolean;
} {
	const mapLink = MapLinkDataController.instance.getById(player.mapLinkId);

	if (!hasArrived && mapLink.forcedImage) {
		return {
			name: mapLink.forcedImage,
			forced: true
		};
	}

	const departure = player.getPreviousMap();

	if (hasArrived) {
		return {
			name: mapLink.forcedImage ?? `${language}_${destination.id}_`,
			fallback: mapLink.forcedImage ? null : `en_${destination.id}_`,
			forced: Boolean(destination.forcedImage)
		};
	}

	if (destination.id < departure.id) {
		return {
			name: `${language}_${destination.id}_${departure.id}_`,
			fallback: `en_${destination.id}_${departure.id}_`,
			forced: false
		};
	}

	return {
		name: `${language}_${departure.id}_${destination.id}_`,
		fallback: `en_${departure.id}_${destination.id}_`,
		forced: false
	};
}

export class MapCommand {
	@commandRequires(CommandMapPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[], player: Player, packet: CommandMapPacketReq): void {
		const hasArrived = Maps.isArrived(player, new Date());
		const destinationMap = player.getDestination();

		const mapInformation = getMapInformation(player, destinationMap, hasArrived, packet.language);

		response.push(makePacket(CommandMapDisplayRes, {
			mapId: destinationMap.id,
			mapLink: mapInformation,
			mapType: destinationMap.type,
			hasArrived
		}));
	}
}
