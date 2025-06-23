import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.NONE)
export class SmallEventPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class SmallEventAddSomething extends SmallEventPacket {
	amount!: number;
}
