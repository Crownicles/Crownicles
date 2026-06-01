import {
	describe, expect, it
} from "vitest";
import { LockManager } from "../../src/locks/LockManager";

describe("LockManager", () => {
	it("returns the same lock instance for the same id", () => {
		const manager = new LockManager();
		const lock1 = manager.getLock(42);
		const lock2 = manager.getLock(42);
		expect(lock1).toBe(lock2);
	});

	it("returns distinct locks for distinct ids", () => {
		const manager = new LockManager();
		const lockA = manager.getLock(1);
		const lockB = manager.getLock(2);
		expect(lockA).not.toBe(lockB);
	});

	it("isolates concurrent critical sections per id", async () => {
		const manager = new LockManager();
		const log: string[] = [];

		async function inSection(id: number, label: string): Promise<void> {
			const release = await manager.getLock(id).acquire();
			log.push(`enter ${label}`);
			await Promise.resolve();
			log.push(`exit ${label}`);
			release();
		}

		// Two pairs racing on disjoint ids: they should interleave freely.
		await Promise.all([
			inSection(1, "A1"),
			inSection(2, "A2"),
			inSection(1, "B1"),
			inSection(2, "B2")
		]);

		// For each id, "exit X" precedes "enter Y" of the same id (serialised).
		const onlyId1 = log.filter(s => s.endsWith("A1") || s.endsWith("B1"));
		const onlyId2 = log.filter(s => s.endsWith("A2") || s.endsWith("B2"));
		expect(onlyId1).toEqual(["enter A1", "exit A1", "enter B1", "exit B1"]);
		expect(onlyId2).toEqual(["enter A2", "exit A2", "enter B2", "exit B2"]);
	});
});
