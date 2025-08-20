import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { AdminPlayerInfoData } from "../../types/AdminPlayerInfoData";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandSetPlayerInfoReq extends CrowniclesPacket {
	keycloakId!: string;

	dataToSet!: AdminPlayerInfoData;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSetPlayerInfoRes extends CrowniclesPacket {
	keycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSetPlayerInfoDoesntExistError extends CrowniclesPacket {}
