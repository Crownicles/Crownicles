import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { AdminPlayerInfoData } from "../../types/AdminPlayerInfoData";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGetPlayerInfoReq extends CrowniclesPacket {
	keycloakId!: string;

	dataToGet!: { badges?: boolean };
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGetPlayerInfoRes extends CrowniclesPacket {
	exists!: boolean;

	data!: AdminPlayerInfoData;
}
