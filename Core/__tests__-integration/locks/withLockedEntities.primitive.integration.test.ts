import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic
} from "sequelize";
import {
	setupIntegrationDb, IntegrationTestEnvironment, waitFor
} from "../_setup";
import { withLockedEntities } from "../../../Lib/src/locks/withLockedEntities";

/**
 * Integration tests for `withLockedEntities` against a real MariaDB.
 *
 * These tests are the only ones that can prove the safety guarantees we
 * actually rely on at runtime: `SELECT … FOR UPDATE` row-locking, CLS
 * propagation of the transaction handle to nested `model.save()`, and
 * automatic rollback on throw. Unit tests in `Lib/tests/locks/` cover
 * the deterministic logic (sort, dedup, error paths) without a DB.
 */

// Two ad-hoc models so we can test single-row locks AND composite locks
// without dragging the entire game schema into PR-AB. Real handlers
// (Player / Guild / Pet / Home) are exercised in PR-C onwards.
class Account extends Model {
	declare id: number;

	declare balance: number;
}
class Inventory extends Model {
	declare id: number;

	declare stock: number;
}

let env: IntegrationTestEnvironment;
let AccountModel: ModelStatic<Account>;
let InventoryModel: ModelStatic<Inventory>;

beforeAll(async () => {
	env = await setupIntegrationDb("withlockedentities");

	AccountModel = Account.init({
		id: {
			type: DataTypes.INTEGER, primaryKey: true
		},
		balance: {
			type: DataTypes.INTEGER, allowNull: false
		}
	}, {
		sequelize: env.sequelize, tableName: "account", timestamps: false
	});
	InventoryModel = Inventory.init({
		id: {
			type: DataTypes.INTEGER, primaryKey: true
		},
		stock: {
			type: DataTypes.INTEGER, allowNull: false
		}
	}, {
		sequelize: env.sequelize, tableName: "inventory", timestamps: false
	});

	await env.sequelize.sync();
}, 60_000);

afterAll(async () => {
	await env?.teardown();
}, 60_000);

beforeEach(async () => {
	await AccountModel.destroy({ where: {}, truncate: true });
	await InventoryModel.destroy({ where: {}, truncate: true });
	await AccountModel.bulkCreate([
		{ id: 1, balance: 100 },
		{ id: 2, balance: 50 }
	]);
	await InventoryModel.bulkCreate([
		{ id: 1, stock: 10 }
	]);
});

describe("withLockedEntities (integration)", () => {
	it("commits the callback's mutations to the locked row", async () => {
		const result = await withLockedEntities(
			[{ model: AccountModel, id: 1 }],
			async ([account]) => {
				account.balance += 25;
				await account.save();
				return account.balance;
			}
		);
		expect(result).toBe(125);

		const fresh = await AccountModel.findByPk(1);
		expect(fresh?.balance).toBe(125);
	});

	it("rolls back every mutation when the callback throws", async () => {
		await expect(withLockedEntities(
			[{ model: AccountModel, id: 1 }],
			async ([account]) => {
				account.balance = 9999;
				await account.save();
				throw new Error("kaboom");
			}
		)).rejects.toThrow("kaboom");

		const fresh = await AccountModel.findByPk(1);
		expect(fresh?.balance).toBe(100);
	});

	it("serialises two callers racing for the same row (FOR UPDATE blocks)", async () => {
		// The flow we want to observe:
		//   t=0  A enters and locks account#1
		//   t≈0  B tries to enter the same lock — must block
		//   t=…  A increments and commits
		//   t=…  B unblocks, sees the *committed* value, increments, commits
		// If FOR UPDATE doesn't actually block B, both callers read 100,
		// both write 110, and the final balance is 110 (lost update).
		// Under proper locking the final balance is 120.

		const events: string[] = [];

		const txA = withLockedEntities(
			[{ model: AccountModel, id: 1 }],
			async ([account]) => {
				events.push("A:locked");
				// Hold the lock long enough for B to attempt acquisition.
				await new Promise(resolve => setTimeout(resolve, 200));
				account.balance += 10;
				await account.save();
				events.push("A:committed");
			}
		);

		// Make sure A enters first.
		await waitFor(() => events.includes("A:locked"));

		const txB = withLockedEntities(
			[{ model: AccountModel, id: 1 }],
			async ([account]) => {
				events.push("B:locked");
				account.balance += 10;
				await account.save();
				events.push("B:committed");
			}
		);

		await Promise.all([txA, txB]);

		// A must have fully committed before B even sees the lock.
		expect(events).toEqual(["A:locked", "A:committed", "B:locked", "B:committed"]);

		const fresh = await AccountModel.findByPk(1);
		expect(fresh?.balance).toBe(120);
	}, 15_000);

	it("propagates the transaction via CLS to nested save() calls", async () => {
		// Inside `withLockedEntities` we touch a model the helper did NOT
		// lock (Inventory). If CLS works, the rollback below also reverts
		// the inventory mutation; if it doesn't, the inventory save commits
		// independently and survives the throw.
		await expect(withLockedEntities(
			[{ model: AccountModel, id: 1 }],
			async () => {
				const inv = await InventoryModel.findByPk(1);
				inv!.stock = 0;
				await inv!.save();
				throw new Error("rollback please");
			}
		)).rejects.toThrow("rollback please");

		const inventoryAfter = await InventoryModel.findByPk(1);
		expect(inventoryAfter?.stock).toBe(10);
	});

	it("locks several rows, in canonical order, and surfaces them to the callback in caller order", async () => {
		// Composite lock — order at the call site (Account#2, Inventory#1, Account#1)
		// must be preserved in the tuple, while internal acquisition is sorted.
		const result = await withLockedEntities(
			[
				{ model: AccountModel, id: 2 },
				{ model: InventoryModel, id: 1 },
				{ model: AccountModel, id: 1 }
			],
			async ([account2, inventory, account1]) => {
				expect(account2.id).toBe(2);
				expect(inventory.id).toBe(1);
				expect(account1.id).toBe(1);

				account1.balance -= 30;
				account2.balance += 30;
				inventory.stock -= 1;
				await account1.save();
				await account2.save();
				await inventory.save();
				return "done";
			}
		);
		expect(result).toBe("done");

		const [a1, a2, inv] = await Promise.all([
			AccountModel.findByPk(1),
			AccountModel.findByPk(2),
			InventoryModel.findByPk(1)
		]);
		expect(a1?.balance).toBe(70);
		expect(a2?.balance).toBe(80);
		expect(inv?.stock).toBe(9);
	});

	it("dedupes identical keys at the DB level (single FOR UPDATE round-trip)", async () => {
		const result = await withLockedEntities(
			[
				{ model: AccountModel, id: 1 },
				{ model: AccountModel, id: 1 }
			],
			async ([first, second]) => {
				expect(first).toBe(second); // same instance, no duplicate fetch
				first.balance += 5;
				await first.save();
				return first.balance;
			}
		);
		expect(result).toBe(105);

		const fresh = await AccountModel.findByPk(1);
		expect(fresh?.balance).toBe(105);
	});

	it("throws and rolls back when a locked row does not exist", async () => {
		await expect(withLockedEntities(
			[{ model: AccountModel, id: 9999 }],
			() => Promise.resolve("never reached")
		)).rejects.toThrow(/row not found/);

		// Sanity: existing rows untouched.
		const fresh = await AccountModel.findByPk(1);
		expect(fresh?.balance).toBe(100);
	});
});
