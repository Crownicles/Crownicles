import {
	KingChallengeReferenceScores, KingChallengeReward, KingChallengeWeekScores
} from "../types/KingChallenge";

/**
 * The king's challenge: every week, players cross tiers with the score they gain and are rewarded at each crossed tier.
 *
 * The first threshold is fixed, the last one follows the best weekly scores of the previous weeks, and the tiers in between
 * are spaced geometrically: each tier asks for the same ratio of points over the previous one, so the gaps feel even, the
 * lower tiers barely move and the upper ones follow the evolution of the scores. On the logged 2026 weeks, ~78 % of the
 * active players reached the first tier, the median one reached 4 tiers and a tier was crossed every ~1.2 to 1.5 active day.
 *
 * A last "champion" tier stands outside of the ladder: it asks for the average best weekly score of the previous weeks,
 * so it is only reached by the best player of a good week (about one week out of four) and does not stretch the ladder.
 */
export abstract class KingChallengeConstants {
	/**
	 * A player coming back after a day or more gains ~1 100 points (2 000 at most) with their first report:
	 * the first tier asks for a second session instead of being given away
	 */
	static readonly FIRST_TIER_SCORE = 2_000;

	/** The last threshold is this multiplier applied to the averaged reference score */
	static readonly LAST_TIER_REFERENCE_MULTIPLIER = 1.3;

	/** Rank of the weekly score used as reference: the first ones are too noisy (48k to 86k for the first, 29k to 39k for the fifth) */
	static readonly REFERENCE_RANK = 5;

	/** Number of past weeks averaged to smooth the reference score */
	static readonly REFERENCE_WEEKS = 4;

	/** The last threshold never goes below this value, even if the best players are less active */
	static readonly MIN_LAST_TIER_SCORE = 30_000;

	/** Weekly scores of the four weeks before the release, used until enough weeks are recorded */
	static readonly DEFAULT_REFERENCE_SCORES: KingChallengeReferenceScores = {
		ladder: [
			30_890,
			31_358,
			28_827,
			29_155
		],
		champion: [
			55_599,
			55_807,
			54_772,
			57_002
		]
	};

	static readonly THRESHOLD_ROUNDING = 100;

	/**
	 * Reward of each tier, granted once per week when the tier is crossed.
	 * Tokens are the main reward: the most active players lack them, they are credited even above the token cap
	 */
	static readonly REWARDS: readonly KingChallengeReward[] = [
		{
			money: 750, tokens: 2, gems: 0
		},
		{
			money: 1_250, tokens: 2, gems: 0
		},
		{
			money: 1_750, tokens: 3, gems: 1
		},
		{
			money: 2_500, tokens: 3, gems: 1
		},
		{
			money: 3_250, tokens: 4, gems: 1
		},
		{
			money: 4_250, tokens: 5, gems: 2
		},
		{
			money: 5_500, tokens: 6, gems: 2
		},

		// Champion tier: only reached by the best player of a good week, its reward stands out from the ladder
		{
			money: 10_000, tokens: 8, gems: 3
		}
	];

	static readonly TIER_COUNT = KingChallengeConstants.REWARDS.length;

	/** Tiers spaced geometrically, the champion tier excluded */
	static readonly LADDER_TIER_COUNT = KingChallengeConstants.TIER_COUNT - 1;

	private static roundThreshold(threshold: number): number {
		return Math.round(threshold / KingChallengeConstants.THRESHOLD_ROUNDING) * KingChallengeConstants.THRESHOLD_ROUNDING;
	}

	private static average(scores: readonly number[], fallback: readonly number[]): number {
		const usedScores = scores.length > 0 ? scores : fallback;
		return usedScores.reduce((sum, score) => sum + score, 0) / usedScores.length;
	}

	/**
	 * Compute the thresholds of the week from the reference scores of the previous weeks
	 * @param referenceScores
	 */
	static computeThresholds(referenceScores: KingChallengeReferenceScores): number[] {
		const lastLadderThreshold = Math.max(
			KingChallengeConstants.MIN_LAST_TIER_SCORE,
			KingChallengeConstants.average(referenceScores.ladder, KingChallengeConstants.DEFAULT_REFERENCE_SCORES.ladder) * KingChallengeConstants.LAST_TIER_REFERENCE_MULTIPLIER
		);
		const ratio = lastLadderThreshold / KingChallengeConstants.FIRST_TIER_SCORE;
		const lastLadderIndex = KingChallengeConstants.LADDER_TIER_COUNT - 1;
		const ladder = Array.from(
			{ length: KingChallengeConstants.LADDER_TIER_COUNT },
			(_, index) => KingChallengeConstants.roundThreshold(KingChallengeConstants.FIRST_TIER_SCORE * ratio ** (index / lastLadderIndex))
		);

		// The champion tier always stays above the ladder, even after a weak week of the best player
		const championThreshold = Math.max(
			ladder[lastLadderIndex] + KingChallengeConstants.THRESHOLD_ROUNDING,
			KingChallengeConstants.roundThreshold(KingChallengeConstants.average(referenceScores.champion, KingChallengeConstants.DEFAULT_REFERENCE_SCORES.champion))
		);
		return [...ladder, championThreshold];
	}

	/**
	 * Add the scores of the week ending to the history, keeping only the last weeks used for the smoothing
	 * @param referenceScores
	 * @param weekScores
	 */
	static pushReferenceScores(referenceScores: KingChallengeReferenceScores, weekScores: KingChallengeWeekScores): KingChallengeReferenceScores {
		return {
			ladder: [...referenceScores.ladder, weekScores.ladder].slice(-KingChallengeConstants.REFERENCE_WEEKS),
			champion: [...referenceScores.champion, weekScores.champion].slice(-KingChallengeConstants.REFERENCE_WEEKS)
		};
	}

	/**
	 * Number of tiers reached with the given weekly score
	 * @param weeklyScore
	 * @param thresholds
	 */
	static getReachedTier(weeklyScore: number, thresholds: readonly number[]): number {
		return thresholds.filter(threshold => weeklyScore >= threshold).length;
	}

	/**
	 * Sum of the rewards of the tiers after `fromTier` up to `toTier` included
	 * @param fromTier Number of tiers already rewarded
	 * @param toTier Number of tiers now reached
	 */
	static sumRewards(fromTier: number, toTier: number): KingChallengeReward {
		return KingChallengeConstants.REWARDS.slice(fromTier, toTier)
			.reduce((total, reward) => ({
				money: total.money + reward.money,
				tokens: total.tokens + reward.tokens,
				gems: total.gems + reward.gems
			}), {
				money: 0, tokens: 0, gems: 0
			});
	}
}
