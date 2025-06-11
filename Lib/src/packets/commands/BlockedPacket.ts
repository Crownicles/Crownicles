import {
	CrowniclesPacket, sendablePacket, PacketDirection
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class BlockedPacket extends CrowniclesPacket {
	keycloakId!: string;

	reasons!: string[];
}
