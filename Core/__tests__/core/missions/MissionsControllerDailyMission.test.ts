import { afterEach, describe, expect, it, vi } from "vitest";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { DailyMission, DailyMissions } from "../../../src/core/database/game/models/DailyMission";
import type PlayerMissionsInfo from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { missionInterface as exploreDifferentPlacesInterface } from "../../../src/core/missions/interfaces/exploreDifferentPlaces";
import { getCrowniclesNamespace } from "../../../../Lib/src/locks/CLSNamespace";

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

		const updateMissionsCountsUnderLock = (MissionsController as unknown as {
			updateMissionsCountsUnderLock: (
				missionInformation: { missionId: string; count?: number; params?: Record<string, unknown>; set?: boolean; },
				missionSlots: unknown[],
				missionInfo: PlayerMissionsInfo,
				player: unknown,
				response: unknown[],
				dailyMission: DailyMission
			) => Promise<{ daily: boolean; campaign: boolean; }>;
		}).updateMissionsCountsUnderLock.bind(MissionsController);

		const missionInformation = {
			missionId: "exploreDifferentPlaces",
			count: 1,
			params: { placeId: 26 }
		};

		// `*UnderLock` helpers assert they are running inside a Sequelize CLS
		// transaction; this unit test mocks the DB layer entirely, so we
		// install a fake `transaction` value on the shared namespace just for
		// the duration of the call to satisfy `assertUnderLock`.
		const namespace = getCrowniclesNamespace();
		const runWithFakeLockContext = async <R>(fn: () => Promise<R>): Promise<R> =>
			await namespace.runAndReturn(async () => {
				namespace.set("transaction", {});
				return fn();
			});

		const firstResult = await runWithFakeLockContext(() => updateMissionsCountsUnderLock(missionInformation, [], missionInfo, {}, [], dailyMission));

		expect(firstResult.daily).toBe(false);
		expect(missionInfo.dailyMissionNumberDone).toBe(1);
		expect(missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(missionInfo.save).toHaveBeenCalledTimes(1);

		const secondResult = await runWithFakeLockContext(() => updateMissionsCountsUnderLock(missionInformation, [], missionInfo, {}, [], dailyMission));

		expect(secondResult.daily).toBe(false);
		expect(missionInfo.dailyMissionNumberDone).toBe(1);
		expect(missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(missionInfo.save).toHaveBeenCalledTimes(1);
	});
});
