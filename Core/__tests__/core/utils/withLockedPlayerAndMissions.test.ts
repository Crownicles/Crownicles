import {
	beforeEach, describe, expect, it, vi
} from "vitest";

const mocks = vi.hoisted(() => ({
	getDailyMission: vi.fn(),
	getOfPlayer: vi.fn(),
	playerLockKey: vi.fn((id: number) => ({ model: "Player", id })),
	missionsLockKey: vi.fn((id: number) => ({ model: "PlayerMissionsInfo", id })),
	withLockedEntities: vi.fn()
}));

vi.mock("../../../src/core/database/game/models/DailyMission", () => ({
	DailyMissions: { getOrGenerate: mocks.getDailyMission }
}));

vi.mock("../../../src/core/database/game/models/Player", () => ({
	default: { lockKey: mocks.playerLockKey }
}));

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	default: { lockKey: mocks.missionsLockKey },
	PlayerMissionsInfos: { getOfPlayer: mocks.getOfPlayer }
}));

vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: mocks.withLockedEntities
}));

import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";

describe("withLockedPlayerAndMissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("prewarms daily mission and PlayerMissionsInfo before acquiring both lock keys", async () => {
		const lockedPlayer = { id: 42 };
		const lockedMissionsInfo = { playerId: 42 };
		mocks.getDailyMission.mockResolvedValue({});
		mocks.getOfPlayer.mockResolvedValue(lockedMissionsInfo);
		mocks.withLockedEntities.mockImplementation(async (_keys, callback) => callback([lockedPlayer, lockedMissionsInfo]));
		const body = vi.fn().mockResolvedValue("done");

		const result = await withLockedPlayerAndMissions(42, body);

		expect(mocks.getDailyMission).toHaveBeenCalledOnce();
		expect(mocks.getOfPlayer).toHaveBeenCalledWith(42);
		expect(mocks.withLockedEntities).toHaveBeenCalledWith(
			[
				{ model: "Player", id: 42 },
				{ model: "PlayerMissionsInfo", id: 42 }
			],
			expect.any(Function)
		);
		expect(mocks.getDailyMission.mock.invocationCallOrder[0]).toBeLessThan(mocks.getOfPlayer.mock.invocationCallOrder[0]);
		expect(mocks.getOfPlayer.mock.invocationCallOrder[0]).toBeLessThan(mocks.withLockedEntities.mock.invocationCallOrder[0]);
		expect(body).toHaveBeenCalledWith(lockedPlayer);
		expect(result).toBe("done");
	});
});
