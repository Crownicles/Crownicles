import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class GiveFoodToGuildPacket extends CrowniclesPacket {
	quantity!: number;

	selectedFoodIndex!: number;
}
