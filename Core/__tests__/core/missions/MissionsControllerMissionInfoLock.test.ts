import {
	describe, expect, it, vi
} from "vitest";
import type Player from "../../../src/core/database/game/models/Player";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import type { CrowniclesPacket } from "@crownicles/lib";

const mocks = vi.hoisted(() => ({
	calls: [] as string[],
	getDailyMission: vi.fn(),
	getPlayerMissionInfo: vi.fn(),
	withLockedEntities: vi.fn()
}));

vi.mock("../../../src/core/database/game/models/DailyMission", () => ({
	default: class DailyMission {},
	DailyMissions: {
		getOrGenerate: mocks.getDailyMission
	}
}));

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => {
	class PlayerMissionsInfo {
		static tableName = "player_missions_info";

		static lockKey(playerId: number): { model: typeof PlayerMissionsInfo; id: number } {
			return {
				model: PlayerMissionsInfo,
				id: playerId
			};
		}
	}

	return {
		default: PlayerMissionsInfo,
		PlayerMissionsInfo,
		PlayerMissionsInfos: {
			getOfPlayer: mocks.getPlayerMissionInfo
		}
	};
});


vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>();
	return {
		...actual,
		withLockedEntities: mocks.withLockedEntities
	};
});

function createPlayer(): Player {
	return {
		id: 393
	} as Player;
}

describe("MissionsController.update mission info lock", () => {
	it("creates the player mission info row before acquiring the mission lock", async () => {
		const player = createPlayer();
		const response: CrowniclesPacket[] = [];
		mocks.calls = [];
		mocks.getDailyMission.mockImplementation(async () => {
			mocks.calls.push("dailyMission");
			return {};
		});
		mocks.getPlayerMissionInfo.mockImplementation(async () => {
			mocks.calls.push("missionInfo");
			return {};
		});
		mocks.withLockedEntities.mockImplementation(async () => {
			mocks.calls.push("lock");
			return player;
		});

		const updatedPlayer = await MissionsController.update(player, response, { missionId: "earnMoney" });

		expect(updatedPlayer).toBe(player);
		expect(mocks.getPlayerMissionInfo).toHaveBeenCalledWith(player.id);
		expect(mocks.calls).toEqual(["dailyMission", "missionInfo", "lock"]);
	});
});