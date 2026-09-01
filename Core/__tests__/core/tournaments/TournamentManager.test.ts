import {
	describe, expect, it
} from "vitest";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories
} from "../../../../Lib/src/types/Tournament";
import {
	getCategoryForLevel, getEffectiveLevel, getRankRewardFactor, getRewardItemCount, getRewardMultiplier
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
		expect(getRankRewardFactor(first)).toBe(1.5);
		expect(getRankRewardFactor(last)).toBe(0.5);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, first)).toBe(34.5);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, last)).toBe(11.5);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, first)).toBe(17.25);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, last)).toBe(5.75);
	});

	it("scales objects from category ranking while keeping one minimum", () => {
		const first = { rank: 1, categoryParticipantCount: 10 };
		const last = { rank: 10, categoryParticipantCount: 10 };
		expect(getRewardItemCount(50, TournamentCategories.LEVEL_100, first)).toBe(5);
		expect(getRewardItemCount(50, TournamentCategories.LEVEL_100, last)).toBe(2);
		expect(getRewardItemCount(50, TournamentCategories.LEVEL_50, first)).toBe(3);
		expect(getRewardItemCount(50, TournamentCategories.LEVEL_50, last)).toBe(1);
		expect(getRewardItemCount(20, TournamentCategories.LEVEL_50, last)).toBe(1);
	});
});