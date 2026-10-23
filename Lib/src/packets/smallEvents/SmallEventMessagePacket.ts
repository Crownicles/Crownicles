import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventMessagePacket extends SmallEventPacket {
	interactionName!: string;

	destinationLocationId!: number;

	secretEmoji?: string;

	vanishAfterMs?: number;
}
