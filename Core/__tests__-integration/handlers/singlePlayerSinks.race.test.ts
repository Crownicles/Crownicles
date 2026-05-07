/**
 * Race integration test for the collector-based small-event end-callback
 * critical sections fixed by PR-H2 (cart, lottery, altar, witch, limoges,
 * shop, fightPet, petFood, gardener, gobletsGame, goToPVEIsland).
 *
 * Collector small events follow a two-phase shape:
 *   1. `executeSmallEvent` snapshots the player and registers a reaction
 *      collector on it.
 *   2. After the user reacts (or times out) the deferred `endCallback`
 *      fires and mutates `player.money` / `player.score` / etc.
 *
 * Between phase 1 and phase 2 the same player can concurrently consume
 * the same resource through another flow (a second SE accept, a shop
 * buy, a meal purchase, …). The endCallback closes over the stale
 * `player` snapshot captured in phase 1 and would happily re-spend on
 * a row that has already been debited.
 *
 * PR-H2 wraps the body of every collector endCallback in
 * `withLockedPlayerSafe(player, "<seName> endCallback", lockedPlayer => …)`
 * which:
 *   - re-fetches the row with `SELECT … FOR UPDATE`,
 *   - re-evaluates affordability against `lockedPlayer.money`,
 *   - bails out cleanly on `LockedRowNotFoundError` (player vanished).
 *
 * This file models the deferred end-callback shape with a generic
 * "single-player sink" and exercises both the buggy and the locked
 * variants so the assertions remain valid against real MariaDB.
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

	declare score: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("single_player_sinks_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
			score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
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
 * Buggy variant: an SE end-callback that uses the snapshot captured
 * when the collector was created. Affordability is checked against
 * the snapshot, then the row is fetched and decremented — without
 * any lock. Mirrors pre-PR-H2 production code for cart, altar,
 * shop, gardener (paid seed), goToPVEIsland (gems gate), …
 */
async function spendMoneyOnEndCallbackUnsafe(snapshot: { id: number; money: number }, cost: number): Promise<boolean> {
	if (snapshot.money < cost) {
		return false;
	}
	const player = await PlayerModel.findByPk(snapshot.id);
	if (!player) {
		return false;
	}
	player.money -= cost;
	await player.save();
	return true;
}

/**
 * Fixed variant: end-callback re-evaluates affordability against the
 * freshly-locked row inside `withLockedEntities` (the production
 * helper that `withLockedPlayerSafe` delegates to). Mirrors
 * post-PR-H2 production code.
 */
async function spendMoneyOnEndCallbackLocked(snapshotId: number, cost: number): Promise<boolean> {
	return await withLockedEntities(
		[{ model: PlayerModel, id: snapshotId } as LockKey<PlayerRow>],
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

describe("single-player SE end-callback sinks race (integration)", () => {
	it(
		"DEMONSTRATES the bug: stale SE snapshot lets an already-broke player overspend",
		async () => {
			/*
			 * Player starts at 100. The SE collector captures the
			 * snapshot at money=100. Before the user reacts, an
			 * unrelated debit takes the player to 0. The deferred
			 * endCallback then runs against the stale snapshot, sees
			 * money=100 ≥ cost=100, and decrements the row — driving
			 * money to -100.
			 */
			await PlayerModel.create({ id: 1, money: 100 });
			const snapshot = { id: 1, money: 100 };

			// Concurrent debit drains the row before the SE end-callback fires.
			await PlayerModel.update({ money: 0 }, { where: { id: 1 } });

			const success = await spendMoneyOnEndCallbackUnsafe(snapshot, 100);
			const player = await PlayerModel.findByPk(1);
			expect(success).toBe(true);
			expect(player?.money).toBe(-100);
		}
	);

	it(
		"FIXES the bug: locked end-callback re-evaluates affordability against fresh row",
		async () => {
			await PlayerModel.create({ id: 2, money: 100 });

			// Same stale-snapshot scenario as above.
			await PlayerModel.update({ money: 0 }, { where: { id: 2 } });

			const success = await spendMoneyOnEndCallbackLocked(2, 100);
			const player = await PlayerModel.findByPk(2);
			expect(success).toBe(false);
			expect(player?.money).toBe(0);
		}
	);

	it(
		"FIXES the bug: two concurrent SE end-callbacks never both spend the same coins",
		async () => {
			/*
			 * Player has exactly enough for one purchase. Two
			 * collector SEs (e.g. cart accept + altar accept) end at
			 * approximately the same time and both decide to debit
			 * the player. The lock must serialise them so only one
			 * debit lands.
			 */
			await PlayerModel.create({ id: 3, money: 100 });

			const results = await Promise.all([
				spendMoneyOnEndCallbackLocked(3, 100),
				spendMoneyOnEndCallbackLocked(3, 100)
			]);

			expect(results.filter(success => success)).toHaveLength(1);
			const player = await PlayerModel.findByPk(3);
			expect(player?.money).toBe(0);
			expect(player?.money).toBeGreaterThanOrEqual(0);
		}
	);

	it(
		"FIXES the bug: distinct players' SE end-callbacks do not block each other",
		async () => {
			await PlayerModel.create({ id: 41, money: 100 });
			await PlayerModel.create({ id: 42, money: 100 });

			const results = await Promise.all([
				spendMoneyOnEndCallbackLocked(41, 100),
				spendMoneyOnEndCallbackLocked(42, 100)
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
