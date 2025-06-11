import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class AIFightActionChoosePacket extends CrowniclesPacket {
	fightId!: string;

	ms!: number;
}
