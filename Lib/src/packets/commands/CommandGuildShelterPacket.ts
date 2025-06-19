import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildShelterPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildShelterPacketRes extends CrowniclesPacket {
	guildName!: string;

	pets!: OwnedPet[];

	maxCount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildShelterNoPetErrorPacket extends CrowniclesPacket {}
