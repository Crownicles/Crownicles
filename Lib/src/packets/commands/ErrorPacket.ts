import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorPacket extends CrowniclesPacket {
	message!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorMaintenancePacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorBannedPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorResetIsNow extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorSeasonEndIsNow extends CrowniclesPacket {
}
