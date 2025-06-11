import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventUltimateFoodMerchantPacket extends SmallEventPacket {
	interactionName!: string;

	amount?: number;
}
