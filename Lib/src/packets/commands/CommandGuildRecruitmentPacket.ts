import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	GuildJoinError, GuildRecruitmentError, GuildRecruitmentSettings, RecruitingGuild
} from "../../types/GuildRecruitment";

/** Reads the recruitment settings, or changes the fields that are sent. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildRecruitmentPacketReq extends CrowniclesPacket {
	open?: boolean;

	minScore?: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildRecruitmentPacketRes extends CrowniclesPacket {
	settings!: GuildRecruitmentSettings;

	changed!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildRecruitmentErrorPacket extends CrowniclesPacket {
	error!: GuildRecruitmentError;
}

/** Without a search, the guilds the player can join, the most fitting first. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildRecruitmentListPacketReq extends CrowniclesPacket {
	search?: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildRecruitmentListPacketRes extends CrowniclesPacket {
	guilds!: RecruitingGuild[];

	search?: string;

	playerScore!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildJoinPacketReq extends CrowniclesPacket {
	guildId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildJoinPacketRes extends CrowniclesPacket {
	guildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildJoinErrorPacket extends CrowniclesPacket {
	error!: GuildJoinError;

	minScore?: number;
}
