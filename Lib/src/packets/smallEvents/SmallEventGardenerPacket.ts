import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGardenerPacket extends SmallEventPacket {
	interactionName!: string;

	plantId!: number;

	materialId!: number;

	cost!: number;

	conditionKey!: string;
}
