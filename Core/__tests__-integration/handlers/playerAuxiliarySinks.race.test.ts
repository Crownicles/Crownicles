/**
 * Race integration test for the multi-row "player + auxiliary"
 * critical sections fixed by PR-E3 (Home buy/upgrade/move and
 * Enchanter money + gems).
 *
 * Both flows share the same shape: read the Player wallet, validate
 * affordability, mutate an auxiliary row (Home level/cityId, or
 * PlayerMissionsInfo gems via the enchanter), spend money, save both
 * rows. Without locking, two concurrent reactions can either
 * lost-update the player wallet (same generic bug as PR-E2) or
 * over-mutate the auxiliary row (e.g. apply two consecutive level
 * upgrades when only one was funded).
 *
 * PR-E3 wraps the read-validate-mutate-save sequence in
 * `withLockedEntities([Player.lockKey, Home.lockKey])` (or
 * `[Player.lockKey, PlayerMissionsInfo.lockKey]` for the enchanter)
 * so the second contender re-validates against the locked rows and
 * bails out.
 *
 * Why ad-hoc Sequelize models — see the rationale in
 * `handleFoodShopBuy.race.test.ts`. We model a generic "player buys
 * an upgrade for an auxiliary row" sink that captures both flows.
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

class AuxRow extends Model {
	declare id: number;

	declare ownerId: number;

	declare level: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let AuxModel: ModelStatic<AuxRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("player_aux_sinks_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row_aux", timestamps: false }
	);
	AuxModel = AuxRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			ownerId: { type: DataTypes.INTEGER, allowNull: false },
			level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "aux_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await PlayerModel.destroy({ where: {}, truncate: true });
	await AuxModel.destroy({ where: {}, truncate: true });
});

/**
 * Buggy variant: read both rows, validate, mutate, save — without
 * holding any row lock. Mirrors the pre-PR-E3 production code paths
 * for home upgrade/move and enchanter spend.
 */
async function upgradeAuxUnsafe(playerId: number, auxId: number, cost: number): Promise<boolean> {
	const player = await PlayerModel.findByPk(playerId);
	const aux = await AuxModel.findByPk(auxId);
	if (!player || !aux || player.money < cost) {
		return false;
	}
	// Yield once so two unsafe upgraders interleave their
	// read-validate phase and both pass the affordability check on
	// the same stale snapshot.
	await new Promise(resolve => setImmediate(resolve));
	player.money -= cost;
	aux.level += 1;
	await Promise.all([player.save(), aux.save()]);
	return true;
}

/**
 * Fixed variant: lock both rows with `SELECT … FOR UPDATE`,
 * re-validate, mutate, save. Mirrors the post-PR-E3 production code
 * paths.
 */
async function upgradeAuxLocked(playerId: number, auxId: number, cost: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
			{ model: AuxModel, id: auxId } as LockKey<AuxRow>
		] as const,
		async ([player, aux]) => {
			if (player.money < cost) {
				return false;
			}
			player.money -= cost;
			aux.level += 1;
			await Promise.all([player.save(), aux.save()]);
			return true;
		}
	);
}

describe("player + auxiliary row race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe upgraders both succeed but only one debit lands",
		async () => {
			// Player has exactly enough for ONE upgrade. Both
			// concurrent unsafe upgraders pass the affordability check
			// on the stale snapshot…
			await PlayerModel.create({ id: 1, money: 100 });
			await AuxModel.create({ id: 11, ownerId: 1, level: 1 });

			const results = await Promise.all([
				upgradeAuxUnsafe(1, 11, 100),
				upgradeAuxUnsafe(1, 11, 100)
			]);

			const player = await PlayerModel.findByPk(1);
			const aux = await AuxModel.findByPk(11);
			// …both reported "spent successfully"…
			expect(results).toEqual([true, true]);
			// …but only ONE 100-debit landed (lost update on player.money)…
			expect(player?.money).toBe(0);
			// …and the aux row also lost-updated: both readers saw
			// level=1 and wrote level=2, so the auxiliary row only
			// got upgraded ONCE despite paying twice.
			expect(aux?.level).toBe(2);
		}
	);

	it(
		"FIXES the bug: locked upgraders serialise affordability check",
		async () => {
			await PlayerModel.create({ id: 2, money: 100 });
			await AuxModel.create({ id: 22, ownerId: 2, level: 1 });

			const results = await Promise.all([
				upgradeAuxLocked(2, 22, 100),
				upgradeAuxLocked(2, 22, 100)
			]);

			// Exactly one upgrade succeeded; the other found `money <
			// cost` against the locked row and returned false.
			const successCount = results.filter(success => success).length;
			expect(successCount).toBe(1);

			const player = await PlayerModel.findByPk(2);
			const aux = await AuxModel.findByPk(22);
			expect(player?.money).toBe(0);
			// Auxiliary row mutated EXACTLY once.
			expect(aux?.level).toBe(2);
		}
	);

	it(
		"FIXES the bug: distinct (player, aux) pairs do not block each other",
		async () => {
			await PlayerModel.create({ id: 41, money: 100 });
			await PlayerModel.create({ id: 42, money: 100 });
			await AuxModel.create({ id: 41_1, ownerId: 41, level: 1 });
			await AuxModel.create({ id: 42_1, ownerId: 42, level: 1 });

			const results = await Promise.all([
				upgradeAuxLocked(41, 41_1, 100),
				upgradeAuxLocked(42, 42_1, 100)
			]);

			expect(results).toEqual([true, true]);
			const [player41, player42, aux41, aux42] = await Promise.all([
				PlayerModel.findByPk(41),
				PlayerModel.findByPk(42),
				AuxModel.findByPk(41_1),
				AuxModel.findByPk(42_1)
			]);
			expect(player41?.money).toBe(0);
			expect(player42?.money).toBe(0);
			expect(aux41?.level).toBe(2);
			expect(aux42?.level).toBe(2);
		}
	);

	it(
		"FIXES the bug: shared aux row across two players still serialises (no level inflation)",
		async () => {
			// Edge case: two players both trying to upgrade the SAME
			// shared auxiliary row (e.g. a guild-owned home or shared
			// storage). The lock on aux serialises them so the level
			// ends at exactly +2, never more.
			await PlayerModel.create({ id: 51, money: 100 });
			await PlayerModel.create({ id: 52, money: 100 });
			await AuxModel.create({ id: 999, ownerId: 51, level: 1 });

			const results = await Promise.all([
				upgradeAuxLocked(51, 999, 100),
				upgradeAuxLocked(52, 999, 100)
			]);

			expect(results).toEqual([true, true]);
			const aux = await AuxModel.findByPk(999);
			expect(aux?.level).toBe(3);
		}
	);
});
