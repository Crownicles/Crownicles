import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RequirementLevelPacket extends CrowniclesPacket {
	requiredLevel!: number;
}
