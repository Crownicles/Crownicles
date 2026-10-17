import {
	describe, expect, it
} from "vitest";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentLevelLimitModes
} from "../../../../Lib/src/types/Tournament";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import {
	asHours, hoursToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import {
	getCategoryForLevel, getEffectiveLevel, getEndingNotificationDate, getRankRewardFactor, getRewardMultiplier,
	getTournamentRewardAmounts, getTournamentRewardItemMinimumRarity
} from "../../../src/core/tournaments/TournamentRules";
import type Tournament from "../../../src/core/database/game/models/Tournament";

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

	it("supports category, unlimited and custom level modes", () => {
		expect(getEffectiveLevel(TournamentCategories.LEVEL_100, 150, {
		levelLimitMode: TournamentLevelLimitModes.CATEGORY,
		levelCap: null
	})).toBe(100);
		expect(getEffectiveLevel(TournamentCategories.LEVEL_100, 150, {
		levelLimitMode: TournamentLevelLimitModes.UNLIMITED,
		levelCap: null
	})).toBe(150);
		expect(getEffectiveLevel(TournamentCategories.LEVEL_100, 150, {
		levelLimitMode: TournamentLevelLimitModes.CAP,
		levelCap: 20
	})).toBe(20);
		expect(getEffectiveLevel(TournamentCategories.LEVEL_100, 15, {
		levelLimitMode: TournamentLevelLimitModes.CAP,
		levelCap: 20
	})).toBe(15);
	});

	it("scales XP and money from category ranking", () => {
		const first = { rank: 1, categoryParticipantCount: 30 };
		const rankEleven = { rank: 11, categoryParticipantCount: 30 };
		const last = { rank: 30, categoryParticipantCount: 30 };
		expect(getRankRewardFactor(first)).toBe(1.2);
		expect(getRankRewardFactor(rankEleven)).toBe(0.5);
		expect(getRankRewardFactor(last)).toBe(0.25);
		expect(getRankRewardFactor({ rank: 0, categoryParticipantCount: 30 })).toBe(1.2);
		expect(getRankRewardFactor({ rank: 99, categoryParticipantCount: 30 })).toBe(0.25);
		expect(getRankRewardFactor({ rank: 10, categoryParticipantCount: 10 })).toBe(0.25);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, first)).toBeCloseTo(27.6);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, rankEleven)).toBe(11.5);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_100, last)).toBe(5.75);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, first)).toBeCloseTo(13.8);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, rankEleven)).toBe(5.75);
		expect(getRewardMultiplier(50, TournamentCategories.LEVEL_50, last)).toBe(2.875);
	});

	it("gives exactly one object to every rank", () => {
		const first = { rank: 1, categoryParticipantCount: 10 };
		const last = { rank: 20, categoryParticipantCount: 20 };
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_100, first).itemCount).toBe(1);
		expect(getTournamentRewardAmounts(50, TournamentCategories.LEVEL_50, last).itemCount).toBe(1);
	});

	it("lowers the top 15 minimum item rarity from legendary to rare", () => {
		expect(getTournamentRewardItemMinimumRarity(1)).toBe(ItemRarity.LEGENDARY);
		expect(getTournamentRewardItemMinimumRarity(2)).toBe(ItemRarity.EPIC);
		expect(getTournamentRewardItemMinimumRarity(6)).toBe(ItemRarity.SPECIAL);
		expect(getTournamentRewardItemMinimumRarity(11)).toBe(ItemRarity.RARE);
		expect(getTournamentRewardItemMinimumRarity(15)).toBe(ItemRarity.RARE);
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

	it("sends the ending notification during the second half of a one day combat phase", () => {
		const registrationEndsAt = new Date("2026-01-01T00:00:00Z");
		const combatEndsAt = new Date("2026-01-02T00:00:00Z");
		const endingDate = getEndingNotificationDate({
			registrationEndsAt,
			combatEndsAt
		} as Tournament);
		expect(endingDate).toEqual(new Date("2026-01-01T12:00:00Z"));
		expect(endingDate.getTime()).toBeGreaterThan(registrationEndsAt.getTime());
	});

	it("sends the ending notification the configured lead before the end of a longer combat phase", () => {
		const endingDate = getEndingNotificationDate({
			registrationEndsAt: new Date("2026-01-01T00:00:00Z"),
			combatEndsAt: new Date("2026-01-04T00:00:00Z")
		} as Tournament);
		expect(endingDate).toEqual(new Date(new Date("2026-01-04T00:00:00Z").getTime()
			- hoursToMilliseconds(asHours(TournamentConstants.ENDING_NOTIFICATION_LEAD_HOURS))));
	});
});