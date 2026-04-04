import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildContributePacketReq extends CrowniclesPacket {
	amount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildContributeSuccessPacket extends CrowniclesPacket {
	amount!: number;

	newTreasury!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildContributeNotEnoughMoneyPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildContributeTooLowPacket extends CrowniclesPacket {
	minAmount!: number;
}
