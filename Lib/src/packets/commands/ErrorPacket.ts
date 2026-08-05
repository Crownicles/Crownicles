import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorPacket extends CrowniclesPacket {
	message!: string;
}

/**
 * An unexpected exception was thrown while processing a packet.
 * Carries no detail: the cause is only logged server-side, never shown to the player.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorInternalPacket extends CrowniclesPacket {
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
