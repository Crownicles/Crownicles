import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventFindPetPacket extends SmallEventPacket {
	isPetReceived!: boolean;

	petIsReceivedByGuild!: boolean; // If false, the player receives the pet

	petTypeID!: number;

	petSex!: SexTypeShort;

	isPetFood!: boolean;
}
