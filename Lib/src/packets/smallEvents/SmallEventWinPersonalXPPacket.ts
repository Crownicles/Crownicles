import { SmallEventAddSomething } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventWinPersonalXPPacket extends SmallEventAddSomething {}
