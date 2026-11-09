import { GuildConstants } from "./GuildConstants";

/** How guilds that built a recruitment office open their doors to players looking for one. */
export abstract class GuildRecruitmentConstants {
	/**
	 * The minimum scores a chief can require, so the setting is picked step by step instead of typed.
	 * The first step lets everyone in.
	 */
	static readonly MIN_SCORE_STEPS = [
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

	/** Guilds shown at once, whether suggested or found by name. */
	static readonly LIST_LIMIT = 15;

	/** Longest name fragment accepted in a search, as long as a guild name can be. */
	static readonly SEARCH_MAX_LENGTH = GuildConstants.GUILD_NAME_LENGTH_RANGE.MAX;

	static isMinScoreStep(value: number): boolean {
		return (GuildRecruitmentConstants.MIN_SCORE_STEPS as readonly number[]).includes(value);
	}
}
