import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventBadPetPacket extends SmallEventPacket {
	loveLost!: number;

	interactionType!: string;

	petId!: number;

	sex!: string;
}
