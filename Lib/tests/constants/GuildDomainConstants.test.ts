import {
	describe, expect, it
} from "vitest";
import {
	GuildBuilding, GuildDomainConstants
} from "../../src/constants/GuildDomainConstants";

describe("GuildDomainConstants.getMaxBuyableFood", () => {
	const foodCaps = GuildDomainConstants.getFoodCaps(0);
	const prices = GuildDomainConstants.SHOP_PRICES.FOOD;

	it("returns full remaining capacity when treasury is unlimited", () => {
		const current = [
			0, 0, 0, 0
		];
		const result = GuildDomainConstants.getMaxBuyableFood(Number.MAX_SAFE_INTEGER, current, foodCaps);
		expect(result).toEqual([
			foodCaps[0], foodCaps[1], foodCaps[2], foodCaps[3]
		]);
	});

	it("returns zero for every food when treasury is empty", () => {
		const current = [
			0, 0, 0, 0
		];
		const result = GuildDomainConstants.getMaxBuyableFood(0, current, foodCaps);
		expect(result).toEqual([
			0, 0, 0, 0
		]);
	});

	it("caps quantity by treasury when treasury < capacity * price", () => {
		const current = [
			0, 0, 0, 0
		];

		// Buy exactly 3 common food (3 * 20 = 60), other foods limited by treasury too
		const result = GuildDomainConstants.getMaxBuyableFood(60, current, foodCaps);
		expect(result[0]).toBe(3); // 60 / 20
		expect(result[1]).toBe(Math.floor(60 / prices[1]));
		expect(result[2]).toBe(Math.floor(60 / prices[2]));
		expect(result[3]).toBe(Math.floor(60 / prices[3]));
	});

	it("caps quantity by remaining capacity when treasury is large but stock near full", () => {
		const current = [
			foodCaps[0] - 1, foodCaps[1] - 2, foodCaps[2], foodCaps[3]
		];
		const result = GuildDomainConstants.getMaxBuyableFood(Number.MAX_SAFE_INTEGER, current, foodCaps);
		expect(result).toEqual([
			1, 2, 0, 0
		]);
	});

	it("never returns negative values when current exceeds cap", () => {
		const current = [
			foodCaps[0] + 5, 0, 0, 0
		];
		const result = GuildDomainConstants.getMaxBuyableFood(10_000, current, foodCaps);
		expect(result[0]).toBe(0);
	});

	it("uses Math.floor for treasury cap (no fractional buys)", () => {
		const current = [
			0, 0, 0, 0
		];

		// 25 money / 20 price = 1.25 -> 1
		const result = GuildDomainConstants.getMaxBuyableFood(25, current, foodCaps);
		expect(result[0]).toBe(1);
	});

	it("returns a result of the same length as prices", () => {
		const current = [
			0, 0, 0, 0
		];
		const result = GuildDomainConstants.getMaxBuyableFood(1_000, current, foodCaps);
		expect(result).toHaveLength(prices.length);
	});
});

describe("GuildDomainConstants.getBuildingRequiredGuildLevel", () => {
	it("allows a level 0 guild to build its first shop", () => {
		expect(GuildDomainConstants.getBuildingRequiredGuildLevel(GuildBuilding.SHOP, 0)).toBe(0);
	});
});

/*
 * The daily cron drives the training ground bonus from TRAINING_LOVE_PER_DAY and only updates guilds
 * whose level appears in it: a level reachable in game but missing from the table would silently give
 * nothing. Same reasoning for the pantry auto-fill rates.
 */
describe("per level reward tables cover every reachable building level", () => {
	it("gives a training ground love value to every reachable level", () => {
		expect(GuildDomainConstants.TRAINING_LOVE_PER_DAY).toHaveLength(
			GuildDomainConstants.BUILDINGS[GuildBuilding.TRAINING_GROUND].maxLevel + 1
		);
	});

	it("gives a pantry auto fill rate to every reachable level", () => {
		expect(GuildDomainConstants.PANTRY_AUTO_FILL).toHaveLength(
			GuildDomainConstants.BUILDINGS[GuildBuilding.PANTRY].maxLevel + 1
		);
	});

	it("never rewards the level 0 of a building that does not exist yet", () => {
		expect(GuildDomainConstants.TRAINING_LOVE_PER_DAY[0]).toBe(0);
		expect(GuildDomainConstants.PANTRY_AUTO_FILL[0].every(rate => rate === 0)).toBe(true);
	});
});
