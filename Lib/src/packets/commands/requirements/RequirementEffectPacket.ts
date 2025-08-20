import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RequirementEffectPacket extends CrowniclesPacket {
	currentEffectId!: string;

	remainingTime!: number;
}
