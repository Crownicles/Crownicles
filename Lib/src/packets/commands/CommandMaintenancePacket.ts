import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandMaintenancePacketReq extends CrowniclesPacket {
	enable!: boolean;

	save!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMaintenancePacketRes extends CrowniclesPacket {
	enabled!: boolean;
}
