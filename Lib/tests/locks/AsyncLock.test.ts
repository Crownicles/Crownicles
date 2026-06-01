import {
	describe, expect, it
} from "vitest";
import { AsyncLock } from "../../src/locks/AsyncLock";

describe("AsyncLock", () => {
	it("acquires immediately when free", async () => {
		const lock = new AsyncLock();
		const release = await lock.acquire();
		release();
	});

	it("serialises concurrent acquirers in FIFO order", async () => {
		const lock = new AsyncLock();
		const order: number[] = [];

		const release1 = await lock.acquire();
		const p2 = lock.acquire().then(release => {
			order.push(2);
			return release;
		});
		const p3 = lock.acquire().then(release => {
			order.push(3);
			return release;
		});
		const p4 = lock.acquire().then(release => {
			order.push(4);
			return release;
		});

		// None of the followers should have entered yet.
		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual([]);

		release1();
		(await p2)();
		(await p3)();
		(await p4)();

		expect(order).toEqual([2, 3, 4]);
	});

	it("releases the lock so subsequent acquirers run sequentially", async () => {
		const lock = new AsyncLock();
		const log: string[] = [];

		async function critical(label: string): Promise<void> {
			const release = await lock.acquire();
			log.push(`enter ${label}`);
			await Promise.resolve();
			log.push(`exit ${label}`);
			release();
		}

		await Promise.all([critical("A"), critical("B"), critical("C")]);

		// No interleaving: every "exit X" must come before the next "enter Y".
		expect(log).toEqual([
			"enter A", "exit A",
			"enter B", "exit B",
			"enter C", "exit C"
		]);
	});

	it("does not leak the lock when the holder forgets to release (regression guard)", async () => {
		// This test documents that the lock is *not* automatically released —
		// callers must always call the release function (typically inside a
		// `finally`). If somebody forgets, subsequent acquirers wait forever.
		const lock = new AsyncLock();
		await lock.acquire(); // never released

		let entered = false;
		const racing = lock.acquire().then(() => {
			entered = true;
		});

		// Yield several times — the second acquirer must still be pending.
		for (let i = 0; i < 5; i++) {
			await Promise.resolve();
		}
		expect(entered).toBe(false);

		// Avoid an unhandled rejection warning on test teardown.
		racing.catch(() => undefined);
	});
});
