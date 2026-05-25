/**
 * Race integration test for the tanner slot-extension double-buy
 * window fixed by `getBuySlotExtensionShopItemCallback` (#3760,
 * commit 8144e4a40).
 *
 * The legacy callback read the player's money + the inventory row,
 * spent the price, bumped the per-category slot count, then saved —
 * all without a row lock. Two concurrent slot-extension purchases
 * (a double-click on the shop reaction) could both pass the
 * affordability check and end up granting two slots for the price of
 * one. Worse: because the two saves of `InventoryInfo` interleaved on
 * the in-memory copy, the second writer's `addSlotForCategory` could
 * overwrite the first writer's increment (lost update — the player
 * pays twice and only gets one slot).
 *
 * The fix wraps validate-mutate-save in
 * `withLockedEntities([Player, InventoryInfo])`. This test reproduces
 * the bug against a faithful ad-hoc schema and verifies the locked
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

	declare money: number;
}

class InventoryInfoRow extends Model {
	declare playerId: number;

	declare weaponSlots: number;
}

let env: IntegrationTestEnvironment;
let PlayerModel: ModelStatic<PlayerRow>;
let InventoryInfoModel: ModelStatic<InventoryInfoRow>;

const SLOT_PRICE = 5000;

beforeAll(async () => {
	env = await setupIntegrationDb("slotext_race");
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
			weaponSlots: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
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

async function buySlotLocked(playerId: number): Promise<boolean> {
	return await withLockedEntities(
		[
			{ model: PlayerModel, id: playerId } as LockKey<PlayerRow>,
			{ model: InventoryInfoModel, id: playerId } as LockKey<InventoryInfoRow>
		],
		async ([lockedPlayer, lockedInv]) => {
			if (lockedPlayer.money < SLOT_PRICE) {
				return false;
			}
			lockedPlayer.money -= SLOT_PRICE;
			lockedInv.weaponSlots += 1;
			await Promise.all([lockedPlayer.save(), lockedInv.save()]);
			return true;
		}
	);
}

describe("TannerShopItems slot extension race (integration)", () => {
	it("FIXES the bug: locked buyers serialise under N-way contention", async () => {
		// Wallet covers exactly ONE slot purchase.
		await PlayerModel.create({ id: 2, money: SLOT_PRICE });
		await InventoryInfoModel.create({ playerId: 2, weaponSlots: 1 });

		// 8 concurrent purchase attempts on a budget of exactly one
		// slot. Without FOR UPDATE, several would pass the
		// affordability check and drive money below zero.
		const results = await Promise.all(
			Array.from({ length: 8 }, () => buySlotLocked(2))
		);

		const successes = results.filter(Boolean).length;
		expect(successes).toBe(1);

		const after = await PlayerModel.findByPk(2);
		expect(after?.money).toBe(0);
		const afterInv = await InventoryInfoModel.findByPk(2);
		expect(afterInv?.weaponSlots).toBe(2);
	});
});
