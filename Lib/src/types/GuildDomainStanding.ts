/**
 * Where the guild domain stands for one player, so a front-end can lock its entrance and say why.
 */
export type GuildDomainStanding = {
	established: boolean;
	isInCity: boolean;
	mapLocationId?: number;
};
