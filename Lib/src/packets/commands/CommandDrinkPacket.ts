import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDrinkPacketReq extends CrowniclesPacket {
	force!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkNoActiveObjectError extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkObjectIsActiveDuringFights extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkCancelDrink extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkConsumePotionRes extends CrowniclesPacket {
	health?: number;

	energy?: number;

	time?: number;
}
