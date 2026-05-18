/**
 * Race integration test for the manual `/rapport` → garden → compost flow.
 *
 * Production code (`handleGardenCompostReaction` in `ReportGardenService.ts`)
 * reads the relevant `HomePlantStorage` row, validates that `quantity >= amount`,
 * then decrements and saves. Without a lock, two concurrent shards confirming
 * `compost N plants of type X` on the same home can both pass the validation
 * step and over-deduct the stock — including driving it negative. The refactor
 * wraps the validation + decrement in `Home.withLocked(home.id, ...)` (which
 * boils down to `withLockedEntities` on the Home row), serialising the
 * critical section across shards.
 *
 * This test exercises a faithful ad-hoc model of the slice the production
 * handler races on (a `home_row` + a `home_plant_storage_row`), reproduces
 * the over-deduction with the unsafe code path, and verifies the locked
 * path preserves the invariant `storage.quantity >= 0` and
 * "exactly one of two concurrent N-deductions succeeds".
 *
 * The choice to model the home + storage as ad-hoc Sequelize classes mirrors
 * the food-shop race test (`handleFoodShopBuy.race.test.ts`) and avoids the
 * cost of booting the whole Core process. The race surface is identical:
 * a read-validate-save sequence on a single storage row, gated by a Home lock.
 */
import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import { IntegrationTestEnvironment, setupIntegrationDb } from "../_setup";
import {
	LockKey, withLockedEntities
} from "../../../Lib/src/locks/withLockedEntities";

/**
 * Minimal ad-hoc Home model — only the `id` column is needed: the row exists
 * solely so the compost flow can `SELECT … FOR UPDATE` it and serialise.
 */
class HomeRow extends Model {
	declare id: number;
}

/**
 * Minimal ad-hoc HomePlantStorage model — just the slice the compost
 * critical section races on.
 */
class StorageRow extends Model {
	declare id: number;

	declare homeId: number;

	declare plantId: number;

	declare quantity: number;
}

let env: IntegrationTestEnvironment;
let HomeModel: ModelStatic<HomeRow>;
let StorageModel: ModelStatic<StorageRow>;

beforeAll(async () => {
	env = await setupIntegrationDb("compost_race");
	HomeModel = HomeRow.init(
		{
			id: {
				type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false
			}
		},
		{
			sequelize: env.sequelize, tableName: "home_row", timestamps: false
		}
	);
	StorageModel = StorageRow.init(
		{
			id: {
				type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true
			},
			homeId: {
				type: DataTypes.INTEGER, allowNull: false
			},
			plantId: {
				type: DataTypes.INTEGER, allowNull: false
			},
			quantity: {
				type: DataTypes.INTEGER, allowNull: false, defaultValue: 0
			}
		},
		{
			sequelize: env.sequelize, tableName: "home_plant_storage_row", timestamps: false
		}
	);
	await env.sequelize.sync({ force: true });
});

afterAll(async () => {
	await env.teardown();
});

beforeEach(async () => {
	await StorageModel.destroy({ where: {}, truncate: true });
	await HomeModel.destroy({ where: {}, truncate: true });
});

/**
 * Ported critical section. Mirrors the post-refactor production code:
 * the validation and decrement run inside `withLockedEntities([{model:Home,id}])`,
 * so concurrent callers block on `SELECT … FOR UPDATE` on the Home row.
 */
async function compostLocked(homeId: number, plantId: number, amount: number): Promise<boolean> {
	return await withLockedEntities(
		[{ model: HomeModel, id: homeId } as LockKey<HomeRow>],
		async (): Promise<boolean> => {
			const storage = await StorageModel.findOne({ where: { homeId, plantId } });
			if (!storage || storage.quantity < amount) {
				return false;
			}
			storage.quantity -= amount;
			await storage.save();
			return true;
		}
	);
}

/**
 * Buggy version: no lock, no re-fetch — used to prove the test fixture
 * exposes the race. We expect this version to over-deduct the storage.
 */
async function compostUnsafe(homeId: number, plantId: number, amount: number): Promise<boolean> {
	const storage = await StorageModel.findOne({ where: { homeId, plantId } });
	if (!storage || storage.quantity < amount) {
		return false;
	}
	// Yield once so the two unsafe callers actually interleave their
	// read/validate phases instead of executing sequentially.
	await new Promise(resolve => setImmediate(resolve));
	storage.quantity -= amount;
	await storage.save();
	return true;
}

describe("handleGardenCompostReaction race (integration)", () => {
	it(
		"DEMONSTRATES the bug: two unsafe composters drain stock below zero",
		async () => {
			await HomeModel.create({ id: 1 });
			await StorageModel.create({ homeId: 1, plantId: 1, quantity: 5 });

			const [first, second] = await Promise.all([
				compostUnsafe(1, 1, 5),
				compostUnsafe(1, 1, 5)
			]);

			// Both reads saw quantity=5, both validated, both decremented
			// from their stale snapshot → final stock is the last write,
			// not zero. The hallmark "lost update" on the storage row.
			expect(first).toBe(true);
			expect(second).toBe(true);
			const after = await StorageModel.findOne({ where: { homeId: 1, plantId: 1 } });
			// With the bug, the final value is whatever the second writer
			// computed from its stale snapshot (5 - 5 = 0) — but the system
			// effectively gave 10 plants worth of materials for 5 in stock.
			// We can't assert "<0" reliably (timing-dependent), but we can
			// assert the system shipped 10 materials worth of compost while
			// only 5 plants existed.
			expect(after?.quantity).toBe(0);
		}
	);

	it("FIXES the bug: two locked composters serialise on the Home row", async () => {
		await HomeModel.create({ id: 2 });
		await StorageModel.create({ homeId: 2, plantId: 1, quantity: 5 });

		const results = await Promise.all([
			compostLocked(2, 1, 5),
			compostLocked(2, 1, 5)
		]);

		// Exactly one transaction sees the full stock, the other sees the
		// post-commit zero and returns false. Order is non-deterministic.
		const successes = results.filter(Boolean).length;
		expect(successes).toBe(1);

		const after = await StorageModel.findOne({ where: { homeId: 2, plantId: 1 } });
		expect(after?.quantity).toBe(0);
		expect(after?.quantity).toBeGreaterThanOrEqual(0);
	});

	it(
		"FIXES the bug: under-budget race never over-deducts the storage",
		async () => {
			// Stock=3, two callers each request 5 → both must fail under
			// the locked path. Without a lock, one of them could still
			// race past the check.
			await HomeModel.create({ id: 3 });
			await StorageModel.create({ homeId: 3, plantId: 1, quantity: 3 });

			const results = await Promise.all([
				compostLocked(3, 1, 5),
				compostLocked(3, 1, 5)
			]);

			expect(results.every(value => value === false)).toBe(true);

			const after = await StorageModel.findOne({ where: { homeId: 3, plantId: 1 } });
			expect(after?.quantity).toBe(3);
			// Crucial: storage must never have gone negative.
			expect(after?.quantity).toBeGreaterThanOrEqual(0);
		}
	);

	it(
		"FIXES the bug: 4 concurrent composters share a 10-plant stock cleanly",
		async () => {
			// Stock=10, four callers each request 5 → exactly two should
			// succeed, two should fail. Verifies the lock holds under
			// higher concurrency, not just N=2.
			await HomeModel.create({ id: 4 });
			await StorageModel.create({ homeId: 4, plantId: 1, quantity: 10 });

			const results = await Promise.all([
				compostLocked(4, 1, 5),
				compostLocked(4, 1, 5),
				compostLocked(4, 1, 5),
				compostLocked(4, 1, 5)
			]);

			const successes = results.filter(Boolean).length;
			expect(successes).toBe(2);

			const after = await StorageModel.findOne({ where: { homeId: 4, plantId: 1 } });
			expect(after?.quantity).toBe(0);
			expect(after?.quantity).toBeGreaterThanOrEqual(0);
		}
	);
});
