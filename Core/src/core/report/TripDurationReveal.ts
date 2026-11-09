import { MapCache } from "../maps/MapCache";
import { MapLocationDataController } from "../../data/MapLocation";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";

/**
 * Trip durations are only sometimes shown, to keep roads a surprise. PvE links always show theirs,
 * and so does the first departure from the castle, where a newcomer learns how long roads are.
 */
export function revealsTripDuration(startingMapId: number, mapLinkId: number): boolean {
	if (MapLocationDataController.instance.getById(startingMapId)?.type === MapLocationConstants.TYPES.CASTLE_THRONE) {
		return true;
	}
	return MapCache.allPveMapLinks.includes(mapLinkId) || RandomUtils.crowniclesRandom.bool();
}
