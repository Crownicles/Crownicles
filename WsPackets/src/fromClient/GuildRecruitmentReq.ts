import { FromClientPacket } from "./FromClientPacket";

/** Reads the recruitment settings, or changes the fields that are sent. */
export class GuildRecruitmentReq extends FromClientPacket {
	public static readonly wireName = "GuildRecruitmentReq";

	open?: boolean;

	minScore?: number;
}

/** Without a search, the guilds the player can join, the most fitting first. */
export class GuildRecruitmentListReq extends FromClientPacket {
	public static readonly wireName = "GuildRecruitmentListReq";

	search?: string;
}

export class GuildJoinReq extends FromClientPacket {
	public static readonly wireName = "GuildJoinReq";

	guildId!: number;
}
