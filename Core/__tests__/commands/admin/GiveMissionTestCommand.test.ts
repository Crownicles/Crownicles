import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { commandInfo } from "../../../src/commands/admin/testCommands/Missions/GiveMissionTestCommand";
import {
	Mission, MissionDataController
} from "../../../src/data/Mission";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";
import Player from "../../../src/core/database/game/models/Player";
import MissionSlot from "../../../src/core/database/game/models/MissionSlot";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

describe("giveMission test command", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function givenDifficulty(difficulty: string): Promise<MissionDifficulty> {
		if (!commandInfo.execute) {
			throw new Error("The giveMission test command has no execute function");
		}
		vi.spyOn(MissionDataController.instance, "getById").mockReturnValue({
			id: "fightAttacks", campaignOnly: false
		} as Mission);
		const addMission = vi.spyOn(MissionsController, "addMissionToPlayer")
			.mockResolvedValue({ missionObjective: 1 } as MissionSlot);
		await commandInfo.execute({} as Player, ["fightAttacks", difficulty], [], {} as PacketContext);
		return addMission.mock.calls[0][2];
	}

	it.each([
		["easy", MissionDifficulty.EASY],
		["medium", MissionDifficulty.MEDIUM],
		["hard", MissionDifficulty.HARD],
		["m", MissionDifficulty.MEDIUM]
	])("gives the mission with the %s difficulty", async (difficulty, expected) => {
		expect(await givenDifficulty(difficulty)).toBe(expected);
	});

	it("refuses an unknown difficulty", async () => {
		await expect(givenDifficulty("extreme")).rejects.toThrow("Difficulté incorrecte");
	});
});
