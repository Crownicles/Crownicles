import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";
import { ClassKind } from "../../types/ClassKind";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventClassPacket extends SmallEventPacket {
	classKind!: ClassKind;

	interactionName!: string;

	amount?: number;
}
