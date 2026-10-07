import { FromServerPacket } from "../FromServerPacket";
import {
	GuildJoinError, GuildRecruitmentError, GuildRecruitmentSettings, RecruitingGuild
} from "../../objects/GuildRecruitment";

export class GuildRecruitmentRes extends FromServerPacket {
	public static readonly wireName = "GuildRecruitmentRes";

	public settings!: GuildRecruitmentSettings;

	public changed!: boolean;
}

export class GuildRecruitmentErrorRes extends FromServerPacket {
	public static readonly wireName = "GuildRecruitmentErrorRes";

	public error!: GuildRecruitmentError;
}

export class GuildRecruitmentListRes extends FromServerPacket {
	public static readonly wireName = "GuildRecruitmentListRes";

	public guilds!: RecruitingGuild[];

	public search?: string;

	public playerScore!: number;
}

export class GuildJoinRes extends FromServerPacket {
	public static readonly wireName = "GuildJoinRes";

	public guildName!: string;
}

export class GuildJoinErrorRes extends FromServerPacket {
	public static readonly wireName = "GuildJoinErrorRes";

	public error!: GuildJoinError;

	public minScore?: number;
}
