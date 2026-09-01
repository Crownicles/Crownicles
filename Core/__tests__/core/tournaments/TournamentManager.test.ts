import {
	describe, expect, it
} from "vitest";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories
} from "../../../../Lib/src/types/Tournament";
import {
	getCategoryForLevel, getEffectiveLevel, getRewardItemCount, getRewardMultiplier
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

	it("starts rewards at the designed multiplier and halves level 50 rewards", () => {
		expect(getRewardMultiplier(20, TournamentCategories.LEVEL_100)).toBe(20);
		expect(getRewardMultiplier(20, TournamentCategories.LEVEL_50)).toBe(10);
		expect(getRewardMultiplier(39, TournamentCategories.LEVEL_100)).toBe(21);
	});

	it("keeps at least one item for level 50 while scaling item counts", () => {
		expect(getRewardItemCount(20, TournamentCategories.LEVEL_100)).toBe(2);
		expect(getRewardItemCount(20, TournamentCategories.LEVEL_50)).toBe(1);
		expect(getRewardItemCount(100, TournamentCategories.LEVEL_100)).toBe(4);
		expect(getRewardItemCount(100, TournamentCategories.LEVEL_50)).toBe(2);
	});
});