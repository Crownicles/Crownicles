/**
 * Race integration test for the player-money "single-row sink" critical
 * sections fixed by PR-E2 (Inn meal/room, TokenHeal buy-heal,
 * Blacksmith upgrade/disenchant).
 *
 * All five handlers share the same shape: read `player.money` outside
 * any lock, validate `>= cost`, call `player.spendMoney(...)` to
 * decrement, and `player.save()`. With two concurrent calls on the
 * same player both readers see the same stale snapshot, both pass
 * affordability, and one of the two debits is silently lost.
 *
 * PR-E2 wraps the read-validate-spend-save sequence in
 * `Player.withLocked(...)` so the second contender re-validates
 * `money` against the freshly-locked row and bails out (or proceeds if
 * both fit the budget after the first debit).
 *
 * Why ad-hoc Sequelize models — see the rationale in
 * `handleFoodShopBuy.race.test.ts`. We model a generic "money sink"
 * that all five handlers reduce to.
 */
import {
	beforeAll, afterAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";

class PlayerRow extends Model {
	declare id: number;

	declare money: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("player_money_sinks_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy variant: read money, validate, decrement, save — without
 * holding any row lock. Mirrors the pre-PR-E2 production code paths
 * for inn meal, inn room, blacksmith upgrade/disenchant, and token
 * heal buy.
 */
async function spendMoneyUnsafe(playerId: number, cost: number): Promise<boolean> {
	const player = await PlayerModel.findByPk(playerId);
	if (!player || player.money < cost) {
		return false;
	}
	// Yield once so two unsafe spenders interleave their read-validate
	// phase and both pass the affordability check on the same stale
	// snapshot.
	await new Promise(resolve => setImmediate(resolve));
	player.money -= cost;
	await player.save();
	return true;
}

/**
 * Fixed variant: lock the player row with `SELECT … FOR UPDATE`,
 * re-validate `money` inside the critical section, mutate, save.
 * Mirrors the post-PR-E2 production code paths.
 */
async function spendMoneyLocked(playerId: number, cost: number): Promise<boolean> {
	return await withLockedEntities(
		[{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>],
		async ([player]) => {
			if (player.money < cost) {
				return false;
			}
			player.money -= cost;
			await player.save();
			return true;
		}
	);
}

describe("player money sinks race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe spenders both succeed but only one debit lands",
		async () => {
			// Player has exactly enough for ONE purchase. Both
			// concurrent unsafe spenders pass the affordability check
			// on the stale snapshot…
			await PlayerModel.create({ id: 1, money: 100 });

			const results = await Promise.all([
				spendMoneyUnsafe(1, 100),
				spendMoneyUnsafe(1, 100)
			]);

			const player = await PlayerModel.findByPk(1);
			// …both reported "spent successfully"…
			expect(results).toEqual([true, true]);
			// …but only ONE 100-debit landed (lost update). Player
			// kept 100 they were told they had spent twice.
			expect(player?.money).toBe(0);
		}
	);

	it("FIXES the bug: locked spenders serialise affordability check", async () => {
		await PlayerModel.create({ id: 2, money: 100 });

		const results = await Promise.all([
			spendMoneyLocked(2, 100),
			spendMoneyLocked(2, 100)
		]);

		// Exactly one purchase succeeded; the other found `money <
		// cost` against the locked row and returned false.
		const successCount = results.filter(success => success).length;
		expect(successCount).toBe(1);

		const player = await PlayerModel.findByPk(2);
		expect(player?.money).toBe(0);
	});

	it(
		"FIXES the bug: half-budget race never lets player.money go negative",
		async () => {
			// Player has 100, two parallel 100-purchases — only one
			// can succeed. Money must end at exactly 0, NEVER -100.
			await PlayerModel.create({ id: 3, money: 100 });

			await Promise.all([
				spendMoneyLocked(3, 100),
				spendMoneyLocked(3, 100)
			]);

			const player = await PlayerModel.findByPk(3);
			expect(player?.money).toBe(0);
			expect(player?.money).toBeGreaterThanOrEqual(0);
		}
	);

	it(
		"FIXES the bug: distinct players in flight do not block each other",
		async () => {
			await PlayerModel.create({ id: 41, money: 100 });
			await PlayerModel.create({ id: 42, money: 100 });

			const results = await Promise.all([
				spendMoneyLocked(41, 100),
				spendMoneyLocked(42, 100)
			]);

			expect(results).toEqual([true, true]);
			const [player41, player42] = await Promise.all([
				PlayerModel.findByPk(41), PlayerModel.findByPk(42)
			]);
			expect(player41?.money).toBe(0);
			expect(player42?.money).toBe(0);
		}
	);
});
