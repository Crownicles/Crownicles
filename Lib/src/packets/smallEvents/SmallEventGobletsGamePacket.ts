import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGobletsGamePacket extends SmallEventPacket {
	malus!: SmallEventGobletsGameMalus;

	goblet!: string;

	value!: number;
}

export enum SmallEventGobletsGameMalus {
	LIFE = "life",
	TIME = "time",
	NOTHING = "nothing",
	END = "end"
}
