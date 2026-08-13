import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

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
