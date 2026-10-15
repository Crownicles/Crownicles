import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { AccountAdventure } from "../../types/AccountAdventure";

/** Sent by RestWs while a player chooses which of two accounts sharing an address to keep. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandAccountAdventuresReq extends CrowniclesPacket {
	keycloakIds!: string[];
}

/** Accounts which never started an adventure are left out. */
@sendablePacket(PacketDirection.NONE)
export class CommandAccountAdventuresRes extends CrowniclesPacket {
	adventures!: AccountAdventure[];
}
