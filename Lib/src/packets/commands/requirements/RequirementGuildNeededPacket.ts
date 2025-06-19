import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RequirementGuildNeededPacket extends CrowniclesPacket {}
