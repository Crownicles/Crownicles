import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventClassOriginalityPacket extends SmallEventPacket {
	isSuccess?: boolean;
}