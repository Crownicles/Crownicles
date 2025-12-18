import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventFightPetPacket extends SmallEventPacket {
	isSuccess!: boolean;

	fightPetActionId!: string;

	isFemale!: boolean; // Sex of the feral pet for gendered translations
}
