import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * An unexpected failure happened while processing a packet.
 * Only carries the reason we wrote ourselves, so the player can report it: the caught exception stays server-side.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ErrorInternalPacket extends CrowniclesPacket {
	reason!: string;
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
