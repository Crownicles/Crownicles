import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import type Player from "../../../src/core/database/game/models/Player";

/**
 * Regression test for https://github.com/Crownicles/Crownicles/issues/4207
 *
 * Since the locks refactor, `MissionsController.update` opens its own
 * `withLockedEntities` block and operates on a freshly-fetched Player
 * instance. Callers, however, traditionally mutate the player in memory
 * BEFORE calling `update` (e.g. `this.money += amount`). Without active
 * propagation, those mutations silently disappear when the locked
 * instance is saved (it persists the OLD field values), and the caller's
 * subsequent `Object.assign(this, returnedPlayer)` clobbers its own
 * in-memory increment with the stale DB value.
 *
 * `MissionsController.propagateDirtyFieldsUnderLock` replays the caller's
 * Sequelize-tracked dirty fields onto the locked instance before the
 * mission logic runs, so the caller's mutations are persisted alongside
 * the mission progression.
 *
 * This test exercises the helper directly with the minimal Sequelize
 * surface it needs (`changed()`, `getDataValue()`, `setDataValue()`) and
 * verifies the contract documented above.
 */

interface FakePlayer {
	changed: () => string[] | false;
	getDataValue: (field: string) => unknown;
	setDataValue: (field: string, value: unknown) => void;
}

function makeFakePlayer(values: Record<string, unknown>, dirtyFields: string[] | false): FakePlayer {
	const data: Record<string, unknown> = { ...values };
	return {
		changed: () => dirtyFields,
		getDataValue: (field: string) => data[field],
		setDataValue: (field: string, value: unknown) => {
			data[field] = value;
		}
	};
}

describe("MissionsController.propagateDirtyFieldsUnderLock", () => {
	const propagate = (MissionsController as unknown as {
		propagateDirtyFieldsUnderLock: (caller: Player, locked: Player) => void;
	}).propagateDirtyFieldsUnderLock.bind(MissionsController);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("copies every caller-dirty field onto the locked instance", () => {
		const caller = makeFakePlayer({ money: 150, score: 200, experience: 300 }, ["money", "experience"]);
		const locked = makeFakePlayer({ money: 100, score: 200, experience: 250 }, false);

		propagate(caller as unknown as Player, locked as unknown as Player);

		expect(locked.getDataValue("money")).toBe(150);
		expect(locked.getDataValue("experience")).toBe(300);

		// Fields the caller did not mark dirty must not be touched.
		expect(locked.getDataValue("score")).toBe(200);
	});

	it("is a no-op when the caller has no dirty fields", () => {
		const caller = makeFakePlayer({ money: 100 }, false);
		const locked = makeFakePlayer({ money: 100 }, false);
		const setSpy = vi.spyOn(locked, "setDataValue");

		propagate(caller as unknown as Player, locked as unknown as Player);

		expect(setSpy).not.toHaveBeenCalled();
		expect(locked.getDataValue("money")).toBe(100);
	});

	it("overwrites locked values even when caller and locked disagree", () => {
		// Simulates the production bug: the caller did `this.money += 50`
		// (150) just before calling update; the locked instance was
		// re-fetched from DB and still holds the pre-increment value (100).
		// Without propagation, the locked save would persist 100 and the
		// caller's `Object.assign` would clobber 150 back to 100.
		const caller = makeFakePlayer({ money: 150 }, ["money"]);
		const locked = makeFakePlayer({ money: 100 }, false);

		propagate(caller as unknown as Player, locked as unknown as Player);

		expect(locked.getDataValue("money")).toBe(150);
	});
});
