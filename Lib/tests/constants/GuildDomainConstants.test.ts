import {
	describe, expect, it
} from "vitest";
import { GuildDomainConstants } from "../../src/constants/GuildDomainConstants";

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
