import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildStoragePacketReq extends CrowniclesPacket {
}

export class FoodStorage {
	id!: string;

	amount!: number;

	maxAmount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildStoragePacketRes extends CrowniclesPacket {
	foods!: FoodStorage[];

	guildName!: string;
}
