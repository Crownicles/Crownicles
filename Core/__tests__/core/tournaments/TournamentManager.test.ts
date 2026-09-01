import {
	describe, expect, it
} from "vitest";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories
} from "../../../../Lib/src/types/Tournament";
import {
	getCategoryForLevel, getEffectiveLevel, getRankRewardFactor, getRewardMultiplier,
	getTournamentRewardAmounts
} from "../../../src/core/tournaments/TournamentRules";

describe("Tournament rules", () => {
	it("assigns the expected category at each level boundary", () => {
		expect(getCategoryForLevel(TournamentConstants.MINIMUM_PLAYER_LEVEL))
			.toBe(TournamentCategories.LEVEL_50);
		expect(getCategoryForLevel(99))
			.toBe(TournamentCategories.LEVEL_50);
		expect(getCategoryForLevel(100))
			.toBe(TournamentCategories.LEVEL_100);
	});

	it("caps the effective level without changing the category", () => {
		expect(getEffectiveLevel(TournamentCategories.LEVEL_50, 42)).toBe(42);
		expect(getEffectiveLevel(TournamentCategories.LEVEL_50, 99)).toBe(50);
		expect(getEffectiveLevel(TournamentCategories.LEVEL_100, 150)).toBe(100);
	});

	it("scales XP and money from category ranking", () => {
		const first = { rank: 1, categoryParticipantCount: 10 };
		const last = { rank: 10, categoryParticipantCount: 10 };
		expect(getRankRewardFactor(first)).toBe(1.2);
		expect(getRankRewardFactor(last)).toBe(0.25);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, first)).toBeCloseTo(27.6);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, last)).toBe(5.75);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, first)).toBeCloseTo(13.8);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, last)).toBe(2.875);
	});

	it("gives exactly one object to every rank", () => {
		const first = { rank: 1, categoryParticipantCount: 10 };
		const last = { rank: 20, categoryParticipantCount: 20 };
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_100, first).itemCount).toBe(1);
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_50, last).itemCount).toBe(1);
	});

	it("uses fixed XP and money bases independent of the player's league", () => {
		const first = { rank: 1, categoryParticipantCount: 10 };
		const last = { rank: 10, categoryParticipantCount: 10 };
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_100, first)).toEqual({
			experience: 55200,
			money: 55200,
			itemCount: 1
		});
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_100, last)).toEqual({
			experience: 11500,
			money: 11500,
			itemCount: 1
		});
	});
});