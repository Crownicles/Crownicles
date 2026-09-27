import Player from "../database/game/models/Player";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";

/** The king's castle is the newcomer's zone: it ends with the hour-long road to a first city. */
export function isInKingCastle(player: Player): boolean {
	return player.getDestination()?.attribute === MapConstants.MAP_ATTRIBUTES.KING_CASTLE;
}
