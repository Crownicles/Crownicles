import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventMessageRecipientPacket extends SmallEventPacket {
	outcome!: string;

	chosenEmoji?: string;

	correctEmoji!: string;

	destinationLocationId!: number;

	moneyWon?: number;

	xpWon?: number;

	damage?: number;

	timeLost?: number;
}
