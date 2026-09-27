import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	AppStateFlag, PendingReveal
} from "../../types/AppState";

/** The app reads what it has already shown the character, and may record what it just showed. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandAppStateReq extends CrowniclesPacket {
	seen?: AppStateFlag[];

	/** Reveals the player has now seen, by id. */
	acknowledged?: number[];
}

/** Sent to the app only: Discord shows everything as it happens. */
@sendablePacket(PacketDirection.NONE)
export class CommandAppStateRes extends CrowniclesPacket {
	seen!: AppStateFlag[];

	reveals!: PendingReveal[];
}
