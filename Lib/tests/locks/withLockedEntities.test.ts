import {
	describe, expect, it, vi
} from "vitest";
import {
	withLockedEntities, LockKey
} from "../../src/locks/withLockedEntities";

/**
 * Minimal "model double" mimicking the slice of Sequelize's `ModelStatic`
 * that {@link withLockedEntities} touches: `tableName`, `name`,
 * `sequelize`, and `findByPk(id, options)`. This keeps the unit tests
 * fully synchronous and DB-free; the real serialisation guarantees of
 * `SELECT … FOR UPDATE` are exercised separately by the integration
 * suite in `Core/__tests__-integration/`.
 */
type FakeRow = { id: number; tag: string };

interface FakeSequelize {
	transaction: (fn: (t: { LOCK: { UPDATE: string } }) => Promise<unknown>) => Promise<unknown>;
}

function makeFakeSequelize(): FakeSequelize {
	return {
		transaction: async fn => fn({ LOCK: { UPDATE: "FOR UPDATE" } })
	};
}

function makeFakeModel(
	tableName: string,
	rows: Record<number, FakeRow>,
	sequelize: FakeSequelize
): {
		tableName: string;
		name: string;
		sequelize: FakeSequelize;
		findByPk: ReturnType<typeof vi.fn>;
	} {
	return {
		tableName,
		name: tableName,
		sequelize,
		findByPk: vi.fn(async (id: number) => rows[id] ?? null)
	};
}

// All the unit tests cast the fake model to `any` only at the call site
// where it crosses into `withLockedEntities` — `LockKey<...>`'s structural
// shape matches the fake exactly, so this is a localised cheat.

describe("withLockedEntities (unit)", () => {
	it("rejects an empty key list", async () => {
		await expect(withLockedEntities([], async () => "never")).rejects.toThrow(/non-empty/);
	});

	it("rejects when the target model is not bound to a Sequelize instance", async () => {
		const orphan = {
			tableName: "ghost",
			name: "Ghost",
			sequelize: null,
			findByPk: vi.fn()
		};
		const key: LockKey = {
			model: orphan as never, id: 1
		};
		await expect(withLockedEntities([key], async () => 1)).rejects.toThrow(/not bound/);
	});

	it("rejects when keys come from different Sequelize instances", async () => {
		const seqA = makeFakeSequelize();
		const seqB = makeFakeSequelize();
		const a = makeFakeModel("a", { 1: { id: 1, tag: "a1" } }, seqA);
		const b = makeFakeModel("b", { 1: { id: 1, tag: "b1" } }, seqB);

		await expect(withLockedEntities(
			[
				{ model: a as never, id: 1 },
				{ model: b as never, id: 1 }
			],
			async () => "never"
		)).rejects.toThrow(/different Sequelize instance/);
	});

	it("acquires locks in canonical (tableName, id) order", async () => {
		const seq = makeFakeSequelize();
		const guild = makeFakeModel("guild", { 5: { id: 5, tag: "g5" } }, seq);
		const player = makeFakeModel("player", {
			2: { id: 2, tag: "p2" },
			7: { id: 7, tag: "p7" }
		}, seq);

		const callOrder: string[] = [];
		guild.findByPk.mockImplementation(async (id: number) => {
			callOrder.push(`guild#${id}`);
			return { id, tag: `g${id}` };
		});
		player.findByPk.mockImplementation(async (id: number) => {
			callOrder.push(`player#${id}`);
			return { id, tag: `p${id}` };
		});

		// Caller passes them in arbitrary order; the helper must sort internally.
		await withLockedEntities(
			[
				{ model: player as never, id: 7 },
				{ model: guild as never, id: 5 },
				{ model: player as never, id: 2 }
			],
			async () => "ok"
		);

		expect(callOrder).toEqual(["guild#5", "player#2", "player#7"]);
	});

	it("passes findByPk a transaction with FOR UPDATE row-lock", async () => {
		const seq = makeFakeSequelize();
		const player = makeFakeModel("player", { 1: { id: 1, tag: "p1" } }, seq);

		await withLockedEntities([{ model: player as never, id: 1 }], async () => "ok");

		expect(player.findByPk).toHaveBeenCalledTimes(1);
		const [id, options] = player.findByPk.mock.calls[0];
		expect(id).toBe(1);
		expect(options).toMatchObject({
			lock: "FOR UPDATE"
		});
		expect(options.transaction).toBeDefined();
	});

	it("returns entities to the callback in the caller's original order", async () => {
		const seq = makeFakeSequelize();
		const guild = makeFakeModel("guild", { 5: { id: 5, tag: "g5" } }, seq);
		const player = makeFakeModel("player", {
			2: { id: 2, tag: "p2" },
			7: { id: 7, tag: "p7" }
		}, seq);

		let received: { tag: string }[] = [];
		await withLockedEntities(
			[
				{ model: player as never, id: 7 },
				{ model: guild as never, id: 5 },
				{ model: player as never, id: 2 }
			],
			async entities => {
				received = entities as { tag: string }[];
				return "ok";
			}
		);

		expect(received.map(r => r.tag)).toEqual(["p7", "g5", "p2"]);
	});

	it("dedupes identical keys but still surfaces them at every position", async () => {
		const seq = makeFakeSequelize();
		const player = makeFakeModel("player", { 3: { id: 3, tag: "p3" } }, seq);

		let received: { tag: string }[] = [];
		await withLockedEntities(
			[
				{ model: player as never, id: 3 },
				{ model: player as never, id: 3 }
			],
			async entities => {
				received = entities as { tag: string }[];
				return "ok";
			}
		);

		// findByPk should have been called only once for the deduped key…
		expect(player.findByPk).toHaveBeenCalledTimes(1);
		// …and both tuple positions point to the same locked instance.
		expect(received).toHaveLength(2);
		expect(received[0]).toBe(received[1]);
	});

	it("throws when a locked row cannot be found", async () => {
		const seq = makeFakeSequelize();
		const player = makeFakeModel("player", {}, seq); // empty rows

		await expect(withLockedEntities(
			[{ model: player as never, id: 99 }],
			async () => "never"
		)).rejects.toThrow(/row not found/);
	});

	it("propagates and surfaces errors thrown inside the callback", async () => {
		const seq = makeFakeSequelize();
		const player = makeFakeModel("player", { 1: { id: 1, tag: "p1" } }, seq);

		const boom = new Error("kaboom");
		await expect(withLockedEntities(
			[{ model: player as never, id: 1 }],
			async () => {
				throw boom;
			}
		)).rejects.toBe(boom);
	});

	it("returns the callback's resolved value on success", async () => {
		const seq = makeFakeSequelize();
		const player = makeFakeModel("player", { 1: { id: 1, tag: "p1" } }, seq);

		const result = await withLockedEntities(
			[{ model: player as never, id: 1 }],
			async () => 1234
		);
		expect(result).toBe(1234);
	});
});
