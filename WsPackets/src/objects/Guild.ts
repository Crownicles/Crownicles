import { ValueAndMax } from "./ValueAndMax";

export type GuildMember = {
	id: number;
	name?: string;
	isSelf: boolean;
	rank: number;
	score: number;
	islandStatus: {
		isOnPveIsland: boolean; isOnBoat: boolean; isPveIslandAlly: boolean; cannotBeJoinedOnBoat: boolean;
	};
};
export type GuildDomainStanding = {
	established: boolean;
	isInCity: boolean;
	mapLocationId?: number;
};
export type GuildDailyStanding = {

	/** Absolute timestamp, so a countdown needs no clock shared with the server. */
	availableAt: number;

	/** A member exploring the mysterious island freezes the reward for the whole guild. */
	blockedByIsland: boolean;
};
export type GuildMembership = {
	treasury: number;
	daily: GuildDailyStanding;
	domain: GuildDomainStanding;
};
export type GuildData = {
	name: string;
	description?: string;
	chiefId: number;
	elderId: number | null;
	level: number;
	isMaxLevel: boolean;
	experience: ValueAndMax;
	rank: {
		unranked: boolean; rank: number; numberOfGuilds: number; score: number;
	};
	members: GuildMember[];

	/** Absent when the player asks about a guild that is not theirs. */
	membership?: GuildMembership;
};
export type GuildCreationStatus = {
	foundGuild: boolean; guildNameIsAvailable?: boolean; guildNameIsAcceptable?: boolean; missingMoney?: number;
};
export type GuildDailyReward = {
	guildName: string;
	pet?: {
		typeId: number; isFemale: boolean;
	};
	money?: number;
	fullHeal?: boolean;
	heal?: number;
	alteration?: { healAmount?: number };
	personalXp?: number;
	guildXp?: number;
	guildPoints?: number;
	commonFood?: number;
	badge?: boolean;
	advanceTime?: number;
	superBadge?: boolean;
};
export type GuildCommandOutcome =
	| {
		type: "memberAction"; action: GuildMemberAction; guildName?: string; memberName?: string;
	}
	| {
		type: "memberError"; error: GuildMemberError;
	}
	| { type: "descriptionUpdated" }
	| {
		type: "descriptionInvalid"; min: number; max: number;
	}
	| { type: "notInGuild" }
	| { type: "forbidden" }
	| {
		type: "left"; guildName: string; isGuildDestroyed?: boolean; newChiefName?: string;
	}
	| {
		type: "created"; guildName: string;
	}
	| {
		type: "creationStatus"; status: GuildCreationStatus;
	}
	| { type: "cancelled" }
	| {
		type: "daily"; reward: GuildDailyReward;
	}
	| {
		type: "dailyCooldown"; totalTime: number; remainingTime: number;
	}
	| { type: "dailyIsland" };

export const GUILD_MEMBER_ACTIONS = {
	INVITED: "invited", JOINED: "joined", REFUSED: "refused", PROMOTED: "promoted", DEMOTED: "demoted", KICKED: "kicked"
} as const;
export type GuildMemberAction = typeof GUILD_MEMBER_ACTIONS[keyof typeof GUILD_MEMBER_ACTIONS];
export const GUILD_MEMBER_ERRORS = {
	NOT_FOUND: "notFound",
	NO_GUILD: "noGuild",
	LEVEL: "level",
	FULL: "full",
	DEAD: "dead",
	ISLAND: "island",
	ALREADY_MEMBER: "alreadyMember",
	SAME_GUILD: "sameGuild",
	SELF: "self",
	ALREADY_ELDER: "alreadyElder",
	NO_ELDER: "noElder",
	BLOCKED: "blocked"
} as const;
export type GuildMemberError = typeof GUILD_MEMBER_ERRORS[keyof typeof GUILD_MEMBER_ERRORS];
