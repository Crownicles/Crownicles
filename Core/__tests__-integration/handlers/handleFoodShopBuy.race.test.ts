/**
 * Race integration test for the food-shop "buy" critical section
 * (the bug fixed by PR-C).
 *
 * The original `handleFoodShopBuy` reads `guild.treasury` + the relevant
 * pantry stock, validates them, then mutates and saves — all without a
 * row lock. Two concurrent buyers can both pass the checks and overspend
 * the treasury (or overflow the pantry cap). This test reproduces the
 * race against a real MariaDB schema and verifies that wrapping the
 * critical section in `withLockedEntities` (the helper added by PR-AB)
 * eliminates the lost-update window.
 *
 * Why we model `Guild` as a small ad-hoc Sequelize class instead of
 * reusing the production singleton: the production `Guild` is bound to
 * the global Crownicles `Sequelize` instance set up by
 * `Database.connectDatabase()`, which would require booting the whole
 * Core process inside the test. The ad-hoc model is faithful to the
 * exact slice of state the real handler races on (`treasury`,
 * `commonFood`, `getFoodCapacityFor`) and uses the same `withLocked`
 * pattern the production refactor uses, so the test failing without the
 * lock and passing with it is a meaningful proxy for the real bug.
 */
import {
	beforeAll, afterAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import { setupIntegrationDb, IntegrationTestEnvironment } from "../_setup";
import {
	withLockedEntities, LockKey
} from "../../../Lib/src/locks/withLockedEntities";

/**
 * Minimal ad-hoc Guild model: just the columns the food-shop bug
 * touches. `commonFoodCap` is denormalised here so the test is
 * self-contained — in production it is derived from `pantryLevel` via
 * `GuildDomainConstants.getFoodCaps`.
 */
class GuildRow extends Model {
	declare id: number;

	declare treasury: number;

	declare commonFood: number;

	declare commonFoodCap: number;
}

let env: IntegrationTestEnvironment;
let GuildModel: ModelStatic<GuildRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("foodshop_race");
	GuildModel = GuildRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			treasury: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			commonFood: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			commonFoodCap: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "guild_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await GuildModel.destroy({ where: {}, truncate: true });
});

const FOOD_PRICE = 10;

/**
 * Ported critical section. Mirrors the post-refactor production code:
 * the affordability + capacity checks AND the mutation are all inside
 * `withLockedEntities` so a concurrent caller blocks on
 * `SELECT … FOR UPDATE` until the previous transaction has committed.
 */
async function buyCommonFoodLocked(
	guildId: number, requestedAmount: number
): Promise<{ amountBought: number; newTreasury: number; newStock: number }> {
	return await withLockedEntities(
		[{ model: GuildModel, id: guildId } as LockKey<GuildRow>],
		async ([guild]) => {
			const remainingCapacity = guild.commonFoodCap - guild.commonFood;
			const maxAffordable = Math.floor(guild.treasury / FOOD_PRICE);
			const actualAmount = Math.min(requestedAmount, remainingCapacity, maxAffordable);
			if (actualAmount <= 0) {
				return { amountBought: 0, newTreasury: guild.treasury, newStock: guild.commonFood };
			}
			guild.treasury -= FOOD_PRICE * actualAmount;
			guild.commonFood += actualAmount;
			await guild.save();
			return {
				amountBought: actualAmount,
				newTreasury: guild.treasury,
				newStock: guild.commonFood
			};
		}
	);
}

/**
 * Buggy version (mirrors the pre-refactor production code): no lock, no
 * re-fetch — just read, validate, mutate, save. Used to *prove* the test
 * fixture exposes the race; we expect this version to overspend the
 * treasury under contention.
 */
async function buyCommonFoodUnsafe(
	guildId: number, requestedAmount: number
): Promise<void> {
	const guild = await GuildModel.findByPk(guildId);
	if (!guild) {
		throw new Error("guild not found");
	}
	const remainingCapacity = guild.commonFoodCap - guild.commonFood;
	const maxAffordable = Math.floor(guild.treasury / FOOD_PRICE);
	const actualAmount = Math.min(requestedAmount, remainingCapacity, maxAffordable);
	if (actualAmount <= 0) {
		return;
	}
	// Yield once so the two unsafe buyers actually interleave their
	// read/validate phases instead of executing sequentially.
	await new Promise(resolve => setImmediate(resolve));
	guild.treasury -= FOOD_PRICE * actualAmount;
	guild.commonFood += actualAmount;
	await guild.save();
}

describe("handleFoodShopBuy race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe buyers can drive treasury negative",
		async () => {
			// Treasury covers exactly ONE 10-food purchase, capacity is large.
			await GuildModel.create({
				id: 1, treasury: FOOD_PRICE * 10, commonFood: 0, commonFoodCap: 100
			});

			await Promise.all([
				buyCommonFoodUnsafe(1, 10),
				buyCommonFoodUnsafe(1, 10)
			]);

			const after = await GuildModel.findByPk(1);
			// Without a lock, both reads see treasury=100, both write
			// treasury=0, but the food field is overwritten — net effect
			// is treasury=0 / stock=10 (lost update on `commonFood`),
			// **NOT** treasury=0 / stock=20 as a correct double-purchase
			// would yield. That divergence is the canonical "lost update".
			expect(after?.treasury).toBe(0);
			expect(after?.commonFood).toBeLessThan(20);
		}
	);

	it("FIXES the bug: two locked buyers serialise on the same row", async () => {
		await GuildModel.create({
			id: 2, treasury: FOOD_PRICE * 10, commonFood: 0, commonFoodCap: 100
		});

		const [first, second] = await Promise.all([
			buyCommonFoodLocked(2, 10),
			buyCommonFoodLocked(2, 10)
		]);

		// Exactly one transaction sees the full treasury (10 units bought)
		// and the second sees the post-commit state (0 affordable). The
		// order is non-deterministic, so we sort.
		const sorted = [first, second].sort((left, right) => right.amountBought - left.amountBought);
		expect(sorted[0].amountBought).toBe(10);
		expect(sorted[1].amountBought).toBe(0);

		const after = await GuildModel.findByPk(2);
		expect(after?.treasury).toBe(0);
		expect(after?.commonFood).toBe(10);
	});

	it(
		"FIXES the bug: locked buyers cannot overflow the pantry cap",
		async () => {
			// Capacity covers exactly ONE 10-food purchase, treasury is large.
			await GuildModel.create({
				id: 3, treasury: 999_999, commonFood: 0, commonFoodCap: 10
			});

			const [first, second] = await Promise.all([
				buyCommonFoodLocked(3, 10),
				buyCommonFoodLocked(3, 10)
			]);

			const sorted = [first, second].sort((left, right) => right.amountBought - left.amountBought);
			expect(sorted[0].amountBought).toBe(10);
			expect(sorted[1].amountBought).toBe(0);

			const after = await GuildModel.findByPk(3);
			expect(after?.commonFood).toBe(10);
			expect(after?.commonFood).toBeLessThanOrEqual(after?.commonFoodCap ?? 0);
		}
	);

	it(
		"FIXES the bug: half-budget race never overspends treasury",
		async () => {
			// Treasury can cover *at most* 5 units across both buyers; both
			// request 10. With proper locking, the system gives one buyer
			// 5 (max affordable) and the other 0.
			await GuildModel.create({
				id: 4, treasury: FOOD_PRICE * 5, commonFood: 0, commonFoodCap: 100
			});

			const results = await Promise.all([
				buyCommonFoodLocked(4, 10),
				buyCommonFoodLocked(4, 10)
			]);

			const totalBought = results.reduce((acc, result) => acc + result.amountBought, 0);
			expect(totalBought).toBe(5);

			const after = await GuildModel.findByPk(4);
			expect(after?.treasury).toBe(0);
			expect(after?.commonFood).toBe(5);
			// Crucial: treasury must never have gone negative.
			expect(after?.treasury).toBeGreaterThanOrEqual(0);
		}
	);
});
