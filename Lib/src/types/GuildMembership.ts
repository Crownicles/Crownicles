/**
 * Where the guild domain stands for one player, so a front-end can lock its entrance and say why.
 */
export type GuildDomainStanding = {
	established: boolean;
	isInCity: boolean;
	mapLocationId?: number;
};

/**
 * Where the shared daily reward stands, so a front-end can lock its button and say why.
 */
export type GuildDailyStanding = {
	/** Absolute timestamp, so a countdown needs no clock shared with the server. */
	availableAt: number;

	/** A member exploring the mysterious island freezes the reward for the whole guild. */
	blockedByIsland: boolean;
};

/**
 * What a guild only tells its own members.
 */
export type GuildMembership = {
	treasury: number;
	daily: GuildDailyStanding;
	domain: GuildDomainStanding;
};
