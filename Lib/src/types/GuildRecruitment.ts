/** Why a guild cannot be joined right now; the first two also say why a listed guild stays closed. */
export const GUILD_JOIN_ERRORS = {
	FULL: "full",
	MIN_SCORE: "minScore",
	CLOSED: "closed",
	NOT_FOUND: "notFound",
	ALREADY_IN_GUILD: "alreadyInGuild",
	ON_ISLAND: "onIsland"
} as const;
export type GuildJoinError = typeof GUILD_JOIN_ERRORS[keyof typeof GUILD_JOIN_ERRORS];
export type GuildJoinBlocker = typeof GUILD_JOIN_ERRORS.FULL | typeof GUILD_JOIN_ERRORS.MIN_SCORE;

export const GUILD_RECRUITMENT_ERRORS = {
	NO_OFFICE: "noOffice",
	INVALID_MIN_SCORE: "invalidMinScore"
} as const;
export type GuildRecruitmentError = typeof GUILD_RECRUITMENT_ERRORS[keyof typeof GUILD_RECRUITMENT_ERRORS];

export type GuildRecruitmentSettings = {
	open: boolean;
	minScore: number;
};

/** A guild recruiting through its office, as a player looking for one sees it. */
export type RecruitingGuild = {
	id: number;
	name: string;
	level: number;
	memberCount: number;
	minScore: number;

	/** Absent when the player can join right away. */
	blocker?: GuildJoinBlocker;
};
