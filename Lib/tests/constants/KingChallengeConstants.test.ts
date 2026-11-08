import {
	describe, expect, it
} from "vitest";
import { KingChallengeConstants } from "../../src/constants/KingChallengeConstants";

const DEFAULT_THRESHOLDS = KingChallengeConstants.computeThresholds(KingChallengeConstants.DEFAULT_REFERENCE_SCORES);

const CHAMPION_INDEX = KingChallengeConstants.TIER_COUNT - 1;

const LAST_LADDER_INDEX = KingChallengeConstants.LADDER_TIER_COUNT - 1;

function thresholdsFor(ladder: number[], champion: number[] = [100_000]): number[] {
	return KingChallengeConstants.computeThresholds({
		ladder, champion
	});
}

describe("KingChallengeConstants", () => {
	describe("computeThresholds", () => {
		it("keeps the first threshold fixed and sets the last ladder threshold from the averaged reference score", () => {
			const thresholds = thresholdsFor([30_000, 40_000]);
			expect(thresholds).toHaveLength(KingChallengeConstants.TIER_COUNT);
			expect(thresholds[0]).toBe(KingChallengeConstants.FIRST_TIER_SCORE);
			expect(thresholds[LAST_LADDER_INDEX]).toBe(35_000 * KingChallengeConstants.LAST_TIER_REFERENCE_MULTIPLIER);
		});

		it("spaces the ladder geometrically, rounded to the hundred, and adds the champion tier", () => {
			expect(thresholdsFor([30_000], [55_000, 57_000])).toEqual([2_000, 3_300, 5_400, 8_800, 14_500, 23_800, 39_000, 56_000]);
		});

		it("moves the upper ladder tiers much more than the lower ones when the reference changes", () => {
			const low = thresholdsFor([30_000]);
			const high = thresholdsFor([40_000]);
			const relativeMoves = low.slice(0, KingChallengeConstants.LADDER_TIER_COUNT)
				.map((threshold, index) => high[index] / threshold);
			for (let index = 1; index < relativeMoves.length; index++) {
				expect(relativeMoves[index]).toBeGreaterThanOrEqual(relativeMoves[index - 1]);
			}
			expect(relativeMoves[0]).toBe(1);
		});

		it("does not stretch the ladder when the best players get stronger", () => {
			const weakChampion = thresholdsFor([30_000], [50_000]);
			const strongChampion = thresholdsFor([30_000], [90_000]);
			expect(strongChampion.slice(0, CHAMPION_INDEX)).toEqual(weakChampion.slice(0, CHAMPION_INDEX));
			expect(strongChampion[CHAMPION_INDEX]).toBe(90_000);
		});

		it("keeps the champion tier above the ladder after a weak week of the best players", () => {
			const thresholds = thresholdsFor([40_000], [10_000]);
			expect(thresholds[CHAMPION_INDEX]).toBe(thresholds[LAST_LADDER_INDEX] + KingChallengeConstants.THRESHOLD_ROUNDING);
		});

		it("never lowers the last ladder threshold below its floor", () => {
			expect(thresholdsFor([1_000])[LAST_LADDER_INDEX]).toBe(KingChallengeConstants.MIN_LAST_TIER_SCORE);
		});

		it("falls back to the default reference scores without history", () => {
			expect(KingChallengeConstants.computeThresholds({
				ladder: [], champion: []
			})).toEqual(DEFAULT_THRESHOLDS);
		});
	});

	it("only keeps the scores of the last weeks", () => {
		expect(KingChallengeConstants.pushReferenceScores({
			ladder: [1, 2, 3, 4], champion: [10]
		}, {
			ladder: 5, champion: 20
		})).toEqual({
			ladder: [2, 3, 4, 5], champion: [10, 20]
		});
	});

	describe("getReachedTier", () => {
		it("counts the thresholds reached", () => {
			expect(KingChallengeConstants.getReachedTier(0, DEFAULT_THRESHOLDS)).toBe(0);
			expect(KingChallengeConstants.getReachedTier(DEFAULT_THRESHOLDS[0] - 1, DEFAULT_THRESHOLDS)).toBe(0);
			expect(KingChallengeConstants.getReachedTier(DEFAULT_THRESHOLDS[0], DEFAULT_THRESHOLDS)).toBe(1);
			expect(KingChallengeConstants.getReachedTier(DEFAULT_THRESHOLDS[3], DEFAULT_THRESHOLDS)).toBe(4);
			expect(KingChallengeConstants.getReachedTier(10_000_000, DEFAULT_THRESHOLDS)).toBe(KingChallengeConstants.TIER_COUNT);
		});
	});

	describe("sumRewards", () => {
		it("adds the rewards of the crossed tiers only", () => {
			const [first, second, third] = KingChallengeConstants.REWARDS;
			expect(KingChallengeConstants.sumRewards(1, 3)).toEqual({
				money: second.money + third.money,
				tokens: second.tokens + third.tokens,
				gems: second.gems + third.gems
			});
			expect(KingChallengeConstants.sumRewards(0, 1)).toEqual(first);
			expect(KingChallengeConstants.sumRewards(2, 2)).toEqual({
				money: 0, tokens: 0, gems: 0
			});
		});
	});

	it("never gives less to a higher tier", () => {
		const rewards = KingChallengeConstants.REWARDS;
		for (let index = 1; index < rewards.length; index++) {
			expect(rewards[index].money).toBeGreaterThan(rewards[index - 1].money);
			expect(rewards[index].tokens).toBeGreaterThanOrEqual(rewards[index - 1].tokens);
			expect(rewards[index].gems).toBeGreaterThanOrEqual(rewards[index - 1].gems);
		}
	});
});
