import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	TournamentCategory, TournamentLevelLimitMode, TournamentMenuSummary, TournamentRewardSummary, TournamentStatus, TournamentTopCategory
} from "../../types/Tournament";

export const TournamentErrorCodes = {
	NOT_FOUND: "notFound",
	ACCESS_DENIED: "accessDenied",
	INVALID_PHASE: "invalidPhase",
	ALREADY_REGISTERED: "alreadyRegistered",
	LEVEL_TOO_LOW: "levelTooLow",
	TOO_FEW_PARTICIPANTS: "tooFewParticipants",
	INVALID_CODE: "invalidCode",
	EXPIRED_CODE: "expiredCode",
	USED_CODE: "usedCode",
	CODE_GUILD_MISMATCH: "codeGuildMismatch",
	GUILD_TOO_SMALL: "guildTooSmall",
	INVALID_DURATION: "invalidDuration",
	INVALID_CHANNEL: "invalidChannel",
	INVALID_LEVEL_LIMIT: "invalidLevelLimit",
	LEVEL_TOO_HIGH: "levelTooHigh",
	NO_OPPONENT: "noOpponent",
	PAUSED: "paused",
	NOT_REGISTERED: "notRegistered"
} as const;

export type TournamentErrorCode = typeof TournamentErrorCodes[keyof typeof TournamentErrorCodes];

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentContextPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentContextPacketRes extends CrowniclesPacket {
	active!: boolean;

	participant!: boolean;

	status?: TournamentStatus;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentAdminMenuPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentAdminMenuPacketRes extends CrowniclesPacket {
	tournaments!: TournamentMenuSummary[];

	hasAvailableCode!: boolean;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentOwnerMenuPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentOwnerMenuPacketRes extends CrowniclesPacket {
	pausedTournaments!: TournamentMenuSummary[];
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentPausePacketReq extends CrowniclesPacket {
	discordGuildId!: string;

	discordChannelId!: string;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentGenerateCodePacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentGenerateCodePacketRes extends CrowniclesPacket {
	code!: string;

	expiresAt!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentCreatePacketReq extends CrowniclesPacket {
	code?: string;

	registrationDays!: number;

	combatDays!: number;

	levelLimitMode?: TournamentLevelLimitMode;

	levelCap?: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentCreatePacketRes extends CrowniclesPacket {
	tournamentId!: number;

	registrationEndsAt!: number;

	combatEndsAt!: number;

	channelId!: string;

	levelLimitMode!: TournamentLevelLimitMode;

	levelCap!: number | null;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentStatusPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentStatusPacketRes extends CrowniclesPacket {
	tournamentId!: number;

	newlyRegistered!: boolean;

	status!: TournamentStatus;

	levelLimitMode!: TournamentLevelLimitMode;

	levelCap!: number | null;

	discordGuildId!: string;

	discordChannelId!: string;

	registrationEndsAt!: number;

	combatEndsAt!: number;

	participantCount!: number;

	categoryCounts!: Record<TournamentCategory, number>;

	category?: TournamentCategory;

	totalGloryPoints?: number;

	lateRegistration?: boolean;

	rank?: number;

	reward?: TournamentRewardSummary;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentResumePacketReq extends CrowniclesPacket {
	tournamentId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentResumePacketRes extends CrowniclesPacket {
	tournamentId!: number;

	channelId!: string;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentCancelPacketReq extends CrowniclesPacket {
	tournamentId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentCancelPacketRes extends CrowniclesPacket {
	tournamentId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentTopPacketRes extends CrowniclesPacket {
	tournamentId!: number;

	categories!: TournamentTopCategory[];

	pageNumber!: number;

	totalPages!: number;

	elementsPerPage!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentErrorPacketRes extends CrowniclesPacket {
	errorCode!: TournamentErrorCode;
}
