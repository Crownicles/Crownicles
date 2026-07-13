import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { LockedRowNotFoundError } from "../../../../Lib/src/locks/withLockedEntities";

const mocks = vi.hoisted(() => ({
	withLockedPlayerAndMissions: vi.fn(),
	warn: vi.fn()
}));

vi.mock("../../../src/core/database/game/models/Player", () => ({
	default: class Player {}
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: mocks.withLockedPlayerAndMissions
}));

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: mocks.warn }
}));

import { ForeignKeyConstraintError } from "sequelize";
import { withLockedPlayerAndMissionsSafe } from "../../../src/core/utils/withLockedPlayerAndMissionsSafe";

describe("withLockedPlayerAndMissionsSafe", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([
		new LockedRowNotFoundError("players", 42),
		new ForeignKeyConstraintError({
			parent: new Error("foreign key"),
			original: new Error("foreign key"),
			sql: "INSERT INTO player_missions_info",
			fields: { playerId: 42 },
			table: "player_missions_info",
			value: 42,
			index: "player_missions_info_playerId_fk",
			reltype: "child"
		})
	])("warns and skips when the player vanishes (%s)", async error => {
		mocks.withLockedPlayerAndMissions.mockRejectedValue(error);
		const body = vi.fn();

		await expect(withLockedPlayerAndMissionsSafe({ id: 42 } as never, "test context", body)).resolves.toBeUndefined();

		expect(body).not.toHaveBeenCalled();
		expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining("player 42 vanished"));
	});

	it("rethrows unrelated errors", async () => {
		const error = new Error("database unavailable");
		mocks.withLockedPlayerAndMissions.mockRejectedValue(error);

		await expect(withLockedPlayerAndMissionsSafe({ id: 42 } as never, "test context", vi.fn())).rejects.toBe(error);
	});
});
