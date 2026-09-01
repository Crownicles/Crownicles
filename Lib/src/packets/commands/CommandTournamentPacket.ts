import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	TournamentCategory, TournamentStatus, TournamentTopCategory
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
	NO_OPPONENT: "noOpponent",
	PAUSED: "paused",
	NOT_REGISTERED: "notRegistered"
} as const;

export type TournamentErrorCode = typeof TournamentErrorCodes[keyof typeof TournamentErrorCodes];

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
	code!: string;

	registrationDays!: number;

	combatDays!: number;

	guildMemberCount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentCreatePacketRes extends CrowniclesPacket {
	tournamentId!: number;

	registrationEndsAt!: number;

	combatEndsAt!: number;

	channelId!: string;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentRegisterPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentRegisterPacketRes extends CrowniclesPacket {
	tournamentId!: number;

	category!: TournamentCategory;

	attackGloryPoints!: number;

	defenseGloryPoints!: number;

	lateRegistration!: boolean;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTournamentStatusPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentStatusPacketRes extends CrowniclesPacket {
	tournamentId!: number;

	status!: TournamentStatus;

	registrationEndsAt!: number;

	combatEndsAt!: number;

	participantCount!: number;

	categoryCounts!: Record<TournamentCategory, number>;

	category?: TournamentCategory;

	attackGloryPoints?: number;

	defenseGloryPoints?: number;
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
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTournamentErrorPacketRes extends CrowniclesPacket {
	errorCode!: TournamentErrorCode;
}