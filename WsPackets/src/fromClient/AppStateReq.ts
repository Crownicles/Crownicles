import { FromClientPacket } from "./FromClientPacket";
import { AppStateFlag } from "../objects/AppState";
import { Badge } from "../objects/Badge";

/** Reads what the app has already shown the character, and records what it has just shown. */
export class AppStateReq extends FromClientPacket {
	public static readonly wireName = "AppStateReq";

	seen?: AppStateFlag[];

	/** Ids of the reveals the player has now seen. */
	acknowledged?: number[];

	/** Badges the app has now celebrated. */
	revealedBadges?: Badge[];
}
