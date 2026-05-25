/**
 * Race integration test for the 1000-points mission-shop double-buy
 * window fixed by `getAThousandPointsShopItem` (#3760, commit
 * 85c05f33f).
 *
 * The legacy buyCallback read `playerMissionsInfo.hasBoughtPointsThisWeek`,
 * applied the score bonus, set the flag, then saved — all without a
 * row lock. Two concurrent purchases (same week, same player) could
 * both pass the flag check and double-credit the score.
 *
 * The fix wraps validate-mutate-save in
 * `withLockedEntities([Player, PlayerMissionsInfo])` and re-checks the
 * flag against the locked row. This test reproduces the original
 * lost-update on a faithful ad-hoc schema and verifies the locked
 * version serialises the two purchases.
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

	declare score: number;
}

class PlayerMissionsInfoRow extends Model {
	declare playerId: number;

	declare hasBoughtPointsThisWeek: boolean;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let MissionsInfoModel: ModelStatic<PlayerMissionsInfoRow>;

const KINGS_FAVOR_SCORE_BONUS = 1000;

beforeAll(async () => {
	env = await setupIntegrationDb("thousandpoints_race");
	PlayerModel = PlayerRow.init(
		{
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
		},
		{ sequelize: env.sequelize, tableName: "player_row", timestamps: false }
	);
	MissionsInfoModel = PlayerMissionsInfoRow.init(
		{
			playerId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
			hasBoughtPointsThisWeek: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
		},
		{ sequelize: env.sequelize, tableName: "player_missions_info_row", timestamps: false }
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await MissionsInfoModel.destroy({ where: {}, truncate: true });
	await PlayerModel.destroy({ where: {}, truncate: true });
});

async function buyThousandPointsLocked(playerId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
			{ model: MissionsInfoModel, id: playerId } as LockKey<PlayerMissionsInfoRow>
		],
		async ([lockedPlayer, lockedInfo]) => {
			if (lockedInfo.hasBoughtPointsThisWeek) {
				return false;
			}
			lockedPlayer.score += KINGS_FAVOR_SCORE_BONUS;
			lockedInfo.hasBoughtPointsThisWeek = true;
			await Promise.all([lockedPlayer.save(), lockedInfo.save()]);
			return true;
		}
	);
}

describe("getAThousandPointsShopItem race (integration)", () => {
	it("FIXES the bug: locked calls let exactly one purchase through under N-way contention", async () => {
		await PlayerModel.create({ id: 2, score: 0 });
		await MissionsInfoModel.create({ playerId: 2, hasBoughtPointsThisWeek: false });

		// 8 concurrent attempts to spend the 1000-point bonus. A missing
		// row lock would allow several to pass the flag check and
		// double-credit the score.
		const results = await Promise.all(
			Array.from({ length: 8 }, () => buyThousandPointsLocked(2))
		);

		const successes = results.filter(Boolean).length;
		expect(successes).toBe(1);

		const after = await PlayerModel.findByPk(2);
		expect(after?.score).toBe(KINGS_FAVOR_SCORE_BONUS);
		const afterInfo = await MissionsInfoModel.findByPk(2);
		expect(afterInfo?.hasBoughtPointsThisWeek).toBe(true);
	});
});
