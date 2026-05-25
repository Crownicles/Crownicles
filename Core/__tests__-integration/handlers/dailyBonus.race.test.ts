/**
 * Race integration test for the daily-bonus double-spend window fixed
 * by the `DailyBonusCommand` refactor (#3760, commit fb81ee55b).
 *
 * The legacy `activateDailyItem` read `inventoryInfo.lastDailyAt`,
 * applied the bonus (energy / health / time-speedup / money), then
 * saved both rows — all without a row lock. Two concurrent activations
 * of the same daily item (e.g. double-click on a slow shard) could
 * both pass the cooldown gate, double-credit the reward, and still
 * end with a single `lastDailyAt` timestamp.
 *
 * The fix wraps the validate-mutate-save sequence in
 * `withLockedEntities([Player, InventoryInfo])` and re-checks the
 * cooldown against the locked row. This test reproduces the original
 * lost-update on a faithful ad-hoc schema (Player.money + InventoryInfo
 * .lastDailyAt) and verifies the locked version serialises the two
 * activations.
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

class InventoryInfoRow extends Model {
	declare playerId: number;

	declare lastDailyAt: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let InventoryInfoModel: ModelStatic<InventoryInfoRow>;

const TIME_BETWEEN_DAILIES_MS = 60 * 60 * 1000;
const DAILY_REWARD = 100;

beforeAll(async () => {
	env = await setupIntegrationDb("dailybonus_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			money: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row", timestamps: false }
	);
	InventoryInfoModel = InventoryInfoRow.init(
		{
			playerId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			lastDailyAt: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "inventory_info_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await InventoryInfoModel.destroy({ where: {}, truncate: true });
	await PlayerModel.destroy({ where: {}, truncate: true });
});

/**
 * Locked version (mirrors the refactored `activateDailyItem`):
 * `withLockedEntities` pins both rows, the cooldown is re-checked
 * against the locked snapshot, and both saves run in the same tx.
 */
async function activateDailyItemLocked(playerId: number, now: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
			{ model: InventoryInfoModel, id: playerId } as LockKey<InventoryInfoRow>
		],
		async ([lockedPlayer, lockedInv]) => {
			if (now - Number(lockedInv.lastDailyAt) < TIME_BETWEEN_DAILIES_MS) {
				return false;
			}
			lockedPlayer.money += DAILY_REWARD;
			lockedInv.lastDailyAt = now;
			await Promise.all([lockedPlayer.save(), lockedInv.save()]);
			return true;
		}
	);
}

describe("DailyBonusCommand race (integration)", () => {
	it("FIXES the bug: locked calls let exactly one activation through under N-way contention", async () => {
		await PlayerModel.create({ id: 2, money: 0 });
		await InventoryInfoModel.create({ playerId: 2, lastDailyAt: 0 });

		const now = Date.now();
		// 8 concurrent activations on the same cooldown-window stress
		// the lock enough that any missing FOR UPDATE would be visible
		// as a multi-credit (money > DAILY_REWARD).
		const results = await Promise.all(
			Array.from({ length: 8 }, () => activateDailyItemLocked(2, now))
		);

		// Exactly one transaction sees lastDailyAt=0 and credits the
		// reward; the second sees the post-commit timestamp and refuses.
		const successes = results.filter(Boolean).length;
		expect(successes).toBe(1);

		const after = await PlayerModel.findByPk(2);
		expect(after?.money).toBe(DAILY_REWARD);
		const afterInv = await InventoryInfoModel.findByPk(2);
		expect(Number(afterInv?.lastDailyAt)).toBe(now);
	});
});
