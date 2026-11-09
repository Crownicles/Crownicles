import { FromClientPacket } from "./FromClientPacket";

export class GuildDescriptionReq extends FromClientPacket {
	public static readonly wireName = "GuildDescriptionReq";

	public description!: string;
}

export class GuildLeaveReq extends FromClientPacket {
	public static readonly wireName = "GuildLeaveReq";
}

export class GuildInviteReq extends FromClientPacket {
	public static readonly wireName = "GuildInviteReq";

	public rank!: number;
}

/** Invites a player met in a ranking, through the opaque handle the ranking sent with them. */
export class GuildInvitePlayerReq extends FromClientPacket {
	public static readonly wireName = "GuildInvitePlayerReq";

	public playerRef!: string;
}

export class GuildPromoteReq extends FromClientPacket {
	public static readonly wireName = "GuildPromoteReq";

	public rank!: number;
}

export class GuildDemoteReq extends FromClientPacket {
	public static readonly wireName = "GuildDemoteReq";
}

export class GuildKickReq extends FromClientPacket {
	public static readonly wireName = "GuildKickReq";

	public rank!: number;
}
