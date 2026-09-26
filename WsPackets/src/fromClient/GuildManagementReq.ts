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
