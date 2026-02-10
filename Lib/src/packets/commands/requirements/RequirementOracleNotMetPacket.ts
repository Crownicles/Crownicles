import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RequirementOracleNotMetPacket extends CrowniclesPacket {}
