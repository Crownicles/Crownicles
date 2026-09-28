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

export type RecruitingGuild = {
	id: number;
	name: string;
	level: number;
	memberCount: number;
	minScore: number;
	blocker?: GuildJoinBlocker;
};

/** The minimum scores a chief can pick from; a RestWs test keeps them equal to Lib's steps. */
export const GUILD_RECRUITMENT_MIN_SCORE_STEPS = [
	0,
	500,
	1_000,
	2_500,
	5_000,
	10_000,
	25_000,
	50_000,
	100_000,
	250_000,
	500_000,
	1_000_000
] as const;
