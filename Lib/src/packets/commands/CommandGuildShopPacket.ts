import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildShopPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildShopNoFoodStorageSpace extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildShopEmpty extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildShopGiveXp extends CrowniclesPacket {
	xp!: number;
}
