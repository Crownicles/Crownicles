import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { Badge } from "../../types/Badge";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGetResourcesReq extends CrowniclesPacket {
	badges?: boolean;
}

@sendablePacket(PacketDirection.NONE)
export class CommandGetResourcesRes extends CrowniclesPacket {
	badges?: Badge[];
}
