import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventBotFactsPacket extends SmallEventPacket {
	information!: string;

	infoNumber!: number;

	infoComplement?: number;
}
