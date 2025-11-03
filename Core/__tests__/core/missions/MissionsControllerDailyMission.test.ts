import { afterEach, describe, expect, it, vi } from "vitest";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { DailyMission, DailyMissions } from "../../../src/core/database/game/models/DailyMission";
import type PlayerMissionsInfo from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { missionInterface as exploreDifferentPlacesInterface } from "../../../src/core/missions/interfaces/exploreDifferentPlaces";

// This test targets the regression where daily missions progressed multiple times for the same location.
describe("MissionsController daily mission blob handling", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should not increment the daily mission when visiting the same place twice", async () => {
		const dailyMission = {
			missionId: "exploreDifferentPlaces",
			missionVariant: 0,
			missionObjective: 3
		} as unknown as DailyMission;

		vi.spyOn(DailyMissions, "getOrGenerate").mockResolvedValue(dailyMission);
		vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue(exploreDifferentPlacesInterface);

		const missionInfo = {
			hasCompletedDailyMission: () => false,
			dailyMissionNumberDone: 0,
			dailyMissionBlob: null as unknown as Buffer,
			save: vi.fn(async () => undefined),
			lastDailyMissionCompleted: null
		} as unknown as PlayerMissionsInfo;

		const updateMissionsCounts = (MissionsController as unknown as {
			updateMissionsCounts: (
				missionInformation: { missionId: string; count?: number; params?: Record<string, unknown>; set?: boolean; },
				missionSlots: unknown[],
				missionInfo: PlayerMissionsInfo
			) => Promise<{ daily: boolean; campaign: boolean; }>;
		}).updateMissionsCounts.bind(MissionsController);

		const missionInformation = {
			missionId: "exploreDifferentPlaces",
			count: 1,
			params: { placeId: 26 }
		};

		const firstResult = await updateMissionsCounts(missionInformation, [], missionInfo);

		expect(firstResult.daily).toBe(false);
		expect(missionInfo.dailyMissionNumberDone).toBe(1);
		expect(missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(missionInfo.save).toHaveBeenCalledTimes(1);

		const secondResult = await updateMissionsCounts(missionInformation, [], missionInfo);

		expect(secondResult.daily).toBe(false);
		expect(missionInfo.dailyMissionNumberDone).toBe(1);
		expect(missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(missionInfo.save).toHaveBeenCalledTimes(1);
	});
});
