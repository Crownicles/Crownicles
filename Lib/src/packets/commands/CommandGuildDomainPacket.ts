import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { GuildDomainSnapshot } from "../../types/GuildDomainSnapshot";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildDomainInfoReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandGuildDomainInfoRes extends CrowniclesPacket {
	data?: GuildDomainSnapshot;
}
