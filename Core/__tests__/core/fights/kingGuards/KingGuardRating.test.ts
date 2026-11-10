import {
	describe, expect, it
} from "vitest";
import {
	computeKingGuardRatingChange, getInitialPlayerGuardGlory, getKingGuardExpectedScore, getPlayerKingGuardKFactor
} from "../../../../src/core/fights/kingGuards/KingGuardRating";
import { KingGuardDataController } from "../../../../src/data/KingGuard";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { EloGameResult } from "../../../../../Lib/src/types/EloGameResult";

const {
	PROVISIONAL_FIGHTS, PROVISIONAL_PLAYER_K_FACTOR, PLAYER_K_FACTOR, GUARD_K_FACTOR, SCALE
} = FightConstants.KING_GUARD.RATING;

describe("getKingGuardExpectedScore", () => {
	it("gives even odds between equal ratings and 10 against 1 for a gap of one scale", () => {
		expect(getKingGuardExpectedScore(1500, 1500)).toBe(0.5);
		expect(getKingGuardExpectedScore(1500 + SCALE, 1500)).toBeCloseTo(10 / 11);
		expect(getKingGuardExpectedScore(1200, 1700) + getKingGuardExpectedScore(1700, 1200)).toBeCloseTo(1);
	});
});

describe("computeKingGuardRatingChange", () => {
	it("raises the player and lowers the guard when the player wins, the more so when the guard was stronger", () => {
		const againstEqual = computeKingGuardRatingChange({
			player: 1500, guard: 1500
		}, EloGameResult.WIN, PLAYER_K_FACTOR);
		const againstStronger = computeKingGuardRatingChange({
			player: 1500, guard: 1900
		}, EloGameResult.WIN, PLAYER_K_FACTOR);

		expect(againstEqual).toEqual({
			playerGuardGlory: 1500,
			playerGuardGloryChange: PLAYER_K_FACTOR / 2,
			guardGlory: 1500,
			guardGloryChange: -GUARD_K_FACTOR / 2
		});
		expect(againstStronger.playerGuardGloryChange).toBeGreaterThan(againstEqual.playerGuardGloryChange);
		expect(againstStronger.guardGloryChange).toBeLessThan(againstEqual.guardGloryChange);
	});

	it("raises the guard when it beats the player, so that it meets stronger players afterwards", () => {
		const change = computeKingGuardRatingChange({
			player: 1500, guard: 1400
		}, EloGameResult.LOSS, PLAYER_K_FACTOR);

		expect(change.playerGuardGloryChange).toBeLessThan(0);
		expect(change.guardGloryChange).toBeGreaterThan(0);
	});

	it("moves nothing on a draw between equal ratings, and favors the weaker side on a draw otherwise", () => {
		expect(computeKingGuardRatingChange({
			player: 1500, guard: 1500
		}, EloGameResult.DRAW, PLAYER_K_FACTOR)).toMatchObject({
			playerGuardGloryChange: 0, guardGloryChange: 0
		});
		const change = computeKingGuardRatingChange({
			player: 1300, guard: 1700
		}, EloGameResult.DRAW, PLAYER_K_FACTOR);
		expect(change.playerGuardGloryChange).toBeGreaterThan(0);
		expect(change.guardGloryChange).toBeLessThan(0);
	});
});

describe("getPlayerKingGuardKFactor", () => {
	it("moves the rating of a player faster during its first rated fights", () => {
		expect(getPlayerKingGuardKFactor(0)).toBe(PROVISIONAL_PLAYER_K_FACTOR);
		expect(getPlayerKingGuardKFactor(PROVISIONAL_FIGHTS - 1)).toBe(PROVISIONAL_PLAYER_K_FACTOR);
		expect(getPlayerKingGuardKFactor(PROVISIONAL_FIGHTS)).toBe(PLAYER_K_FACTOR);
		expect(PROVISIONAL_PLAYER_K_FACTOR).toBeGreaterThan(PLAYER_K_FACTOR);
	});
});

describe("getInitialPlayerGuardGlory", () => {
	const {
		MIN_LEVEL, MAX_LEVEL
	} = FightConstants.KING_GUARD.LIBRARY;

	function guardsRatingsOfLevel(level: number): number[] {
		return KingGuardDataController.instance.getOfClosestLevel(level).map(guard => guard.initialGlory);
	}

	it("starts a player from the median rating of the guards of its level", () => {
		const level = 150;
		const rating = getInitialPlayerGuardGlory(level);
		const ratings = guardsRatingsOfLevel(level);

		expect(ratings.filter(guardRating => guardRating < rating).length).toBe(ratings.filter(guardRating => guardRating > rating).length);
	});

	it("starts the players outside the levels of the library from the closest level of it", () => {
		expect(getInitialPlayerGuardGlory(MIN_LEVEL - 40)).toBe(getInitialPlayerGuardGlory(MIN_LEVEL));
		expect(getInitialPlayerGuardGlory(MAX_LEVEL + 40)).toBe(getInitialPlayerGuardGlory(MAX_LEVEL));
		expect(getInitialPlayerGuardGlory(MAX_LEVEL)).toBeGreaterThan(getInitialPlayerGuardGlory(MIN_LEVEL));
	});
});
