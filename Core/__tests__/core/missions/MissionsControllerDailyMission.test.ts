import {
	describe, expect, it, vi
} from "vitest";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { IMission } from "../../../src/core/missions/IMission";
import { missionInterface as exploreDifferentPlacesInterface } from "../../../src/core/missions/interfaces/exploreDifferentPlaces";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionType } from "../../../../Lib/src/types/CompletedMission";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	buildDailyMission, buildMissionInfo, buildMissionSlot, buildPlayer, completedPackets, DAY_MS, KEYCLOAK_ID, MONEY_BLESSING_MULTIPLIER, SCORE_MULTIPLIER, setupMissionsControllerHarness
} from "./MissionsControllerFixture";

const mocks = vi.hoisted(() => ({
	withLockedEntities: vi.fn(),
	importCompiledFolderExports: vi.fn()
}));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: mocks.withLockedEntities
}));

vi.mock("../../../src/core/utils/DynamicImportUtils", () => ({
	importCompiledFolderExports: mocks.importCompiledFolderExports
}));

/**
 * Mission whose params match when `params.target` equals the variant
 */
const targetedMission: IMission = {
	generateRandomVariant: () => 0,
	areParamsMatchingVariantAndBlob: (variant, params) => params.target === variant,
	initialNumberDone: () => 0,
	updateSaveBlob: () => null
};

describe("MissionsController daily mission", () => {
	const harness = setupMissionsControllerHarness(mocks, {
		exploreDifferentPlaces: exploreDifferentPlacesInterface,
		targeted: targetedMission
	});

	function dailyMissionDone(): number {
		return harness.locked.missionInfo.dailyMissionNumberDone;
	}

	// This test targets the regression where daily missions progressed multiple times for the same location.
	it("does not progress when visiting the same place twice", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "exploreDifferentPlaces",
			missionObjective: 3
		});

		await MissionsController.update(buildPlayer(), [], {
			missionId: "exploreDifferentPlaces", params: { placeId: 26 }
		});

		expect(dailyMissionDone()).toBe(1);
		expect(harness.locked.missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(harness.queries.missionInfoSave).toHaveBeenCalledTimes(1);

		await MissionsController.update(buildPlayer(), [], {
			missionId: "exploreDifferentPlaces", params: { placeId: 26 }
		});

		expect(dailyMissionDone()).toBe(1);
		expect(harness.locked.missionInfo.dailyMissionBlob?.toString()).toBe("26");
		expect(harness.queries.missionInfoSave).toHaveBeenCalledTimes(1);

		await MissionsController.update(buildPlayer(), [], {
			missionId: "exploreDifferentPlaces", params: { placeId: 27 }
		});

		expect(dailyMissionDone()).toBe(2);
		expect(harness.locked.missionInfo.dailyMissionBlob?.toString()).toBe("26,27");
	});

	it("adds the count to the progress, capped by the objective, without completing it before", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "earnMoney", missionObjective: 100
		});
		const response: CrowniclesPacket[] = [];

		await MissionsController.update(buildPlayer(), response, {
			missionId: "earnMoney", count: 40
		});

		expect(dailyMissionDone()).toBe(40);
		expect(harness.locked.missionInfo.lastDailyMissionCompleted).toBeNull();
		expect(harness.queries.missionInfoSave).toHaveBeenCalledTimes(1);
		expect(completedPackets(response)).toHaveLength(0);

		await MissionsController.update(buildPlayer(), response, {
			missionId: "earnMoney", count: 500
		});

		expect(dailyMissionDone()).toBe(100);
	});

	it("progresses by one by default", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "earnMoney", missionObjective: 100
		});

		await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

		expect(dailyMissionDone()).toBe(1);
	});

	it("keeps the best value in set mode", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "reachLevel", missionObjective: 30
		});
		harness.locked.missionInfo = buildMissionInfo({ dailyMissionNumberDone: 12 });

		await MissionsController.update(buildPlayer(), [], {
			missionId: "reachLevel", count: 8, set: true
		});

		expect(dailyMissionDone()).toBe(12);

		await MissionsController.update(buildPlayer(), [], {
			missionId: "reachLevel", count: 20, set: true
		});

		expect(dailyMissionDone()).toBe(20);

		await MissionsController.update(buildPlayer(), [], {
			missionId: "reachLevel", count: 50, set: true
		});

		expect(dailyMissionDone()).toBe(30);
	});

	it("ignores the updates of another mission", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "earnMoney", missionObjective: 3
		});

		await MissionsController.update(buildPlayer(), [], { missionId: "earnXP" });

		expect(dailyMissionDone()).toBe(0);
		expect(harness.queries.missionInfoSave).not.toHaveBeenCalled();
	});

	it("ignores the updates whose params do not match its variant", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "targeted", missionVariant: 4, missionObjective: 3
		});

		await MissionsController.update(buildPlayer(), [], {
			missionId: "targeted", params: { target: 5 }
		});

		expect(dailyMissionDone()).toBe(0);

		await MissionsController.update(buildPlayer(), [], {
			missionId: "targeted", params: { target: 4 }
		});

		expect(dailyMissionDone()).toBe(1);
	});

	it("no longer progresses once completed today", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "earnMoney", missionObjective: 3
		});
		harness.locked.missionInfo = buildMissionInfo({
			dailyMissionNumberDone: 1,
			lastDailyMissionCompleted: new Date()
		});

		await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

		expect(dailyMissionDone()).toBe(1);
		expect(harness.queries.missionInfoSave).not.toHaveBeenCalled();
	});

	it("grants its rewards, multiplied by the blessing and its own multipliers, once completed", async () => {
		const before = Date.now();
		harness.dailyMissionMultiplier = 1.5;
		harness.dailyMission = buildDailyMission({
			missionId: "earnMoney",
			missionVariant: 2,
			missionObjective: 3,
			gemsToWin: 3,
			xpToWin: 7,
			moneyToWin: 9,
			pointsToWin: 5
		});
		harness.locked.missionInfo = buildMissionInfo({
			dailyMissionNumberDone: 2,
			lastDailyMissionCompleted: new Date(Date.now() - 2 * DAY_MS)
		});
		const response: CrowniclesPacket[] = [];

		await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

		expect(dailyMissionDone()).toBe(3);
		expect(harness.locked.missionInfo.lastDailyMissionCompleted.valueOf()).toBeGreaterThanOrEqual(before);
		expect(harness.logs.logMissionDailyFinished).toHaveBeenCalledWith(KEYCLOAK_ID);

		const expectedMoney = Math.round(9 * Constants.MISSIONS.DAILY_MISSION_MONEY_MULTIPLIER * 1.5);
		const expectedPoints = Math.round(5 * Constants.MISSIONS.DAILY_MISSION_POINTS_MULTIPLIER * 1.5);
		expect(harness.rewards.gems.map(gems => gems.amount)).toEqual([5]);
		expect(harness.rewards.experience.map(experience => experience.amount)).toEqual([11]);
		expect(harness.rewards.money).toEqual([{
			amount: expectedMoney, response, reason: NumberChangeReason.MISSION_FINISHED
		}]);
		expect(harness.rewards.score.map(score => score.amount)).toEqual([expectedPoints]);

		const [packet] = completedPackets(response);
		expect(packet.missions).toHaveLength(1);
		expect(packet.missions[0]).toMatchObject({
			missionId: "earnMoney",
			missionVariant: 2,
			missionObjective: 3,
			missionType: MissionType.DAILY,
			gemsToWin: 5,
			xpToWin: 11,
			moneyToWin: expectedMoney * MONEY_BLESSING_MULTIPLIER,
			pointsToWin: Math.round(expectedPoints * SCORE_MULTIPLIER)
		});
	});

	it("is completed only once when the streak it progresses is itself the daily mission", async () => {
		harness.dailyMission = buildDailyMission({
			missionId: "dailyStreak", missionObjective: 1
		});
		const response: CrowniclesPacket[] = [];

		await MissionsController.update(buildPlayer(), response, { missionId: "dailyStreak" });

		const dailyMissions = completedPackets(response).flatMap(packet => packet.missions)
			.filter(mission => mission.missionType === MissionType.DAILY);
		expect(dailyMissions).toHaveLength(1);
		expect(dailyMissionDone()).toBe(1);
	});

	describe("streak", () => {
		function streakSlot(numberDone: number): ReturnType<typeof buildMissionSlot> {
			return buildMissionSlot({
				id: 9, missionId: "dailyStreak", missionObjective: 10, numberDone
			});
		}

		async function completeDailyMission(lastDailyMissionCompleted: Date | null): Promise<void> {
			harness.dailyMission = buildDailyMission({
				missionId: "earnMoney", missionObjective: 1
			});
			harness.locked.missionInfo = buildMissionInfo({ lastDailyMissionCompleted });
			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });
		}

		it("continues the streak of a player who completed the daily mission yesterday", async () => {
			const streak = streakSlot(4);
			harness.missionSlots = [streak];

			await completeDailyMission(new Date(Date.now() - DAY_MS));

			expect(streak.numberDone).toBe(5);
		});

		it("only restarts the streak mission when the player missed a day", async () => {
			const otherMission = buildMissionSlot({
				id: 1, missionId: "earnXP", missionObjective: 10, numberDone: 3
			});
			const streak = streakSlot(4);
			harness.missionSlots = [otherMission, streak];

			await completeDailyMission(new Date(Date.now() - 2 * DAY_MS));

			expect(otherMission.numberDone).toBe(3);
			expect(streak.numberDone).toBe(1);
		});

		it("starts the streak of a player who never completed a daily mission", async () => {
			const streak = streakSlot(4);
			harness.missionSlots = [streak];

			await completeDailyMission(null);

			expect(streak.numberDone).toBe(5);
		});

		it("restarts the streak of a player who missed a day", async () => {
			const streak = streakSlot(4);
			harness.missionSlots = [streak];

			await completeDailyMission(new Date(Date.now() - 2 * DAY_MS));

			expect(streak.numberDone).toBe(1);
			expect(harness.queries.missionSlotSave.mock.contexts).toContain(streak);
		});

		it("does not touch a completed streak", async () => {
			const streak = buildMissionSlot({
				id: 9, missionId: "dailyStreak", missionObjective: 10, numberDone: 10, expiresAt: null
			});
			harness.missionSlots = [streak];

			await completeDailyMission(new Date(Date.now() - 3 * DAY_MS));

			expect(streak.numberDone).toBe(10);
		});

		it("does not progress the streak while the daily mission is not completed", async () => {
			const streak = streakSlot(4);
			harness.missionSlots = [streak];
			harness.dailyMission = buildDailyMission({
				missionId: "earnMoney", missionObjective: 2
			});

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			expect(streak.numberDone).toBe(4);
		});
	});
});
