import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { Campaign } from "../../../src/core/missions/Campaign";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import Player from "../../../src/core/database/game/models/Player";
import { MissionSlot } from "../../../src/core/database/game/models/MissionSlot";
import { PlayerMissionsInfo } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { CampaignData, CampaignMission } from "../../../src/data/Campaign";

// Mock crowniclesInstance (required by Campaign for logging)
vi.mock("../../../src/index", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logMissionCampaignProgress: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

/**
 * This test suite verifies the behavior of Campaign.completeCampaignMissions.
 *
 * Critical regression test for bug #3973 / #3868:
 * When a daily mission and campaign mission share the same objective type,
 * completing both simultaneously causes a recursive call to updatePlayerCampaign
 * with completedCampaign=false. Previously, this would reload the campaign slot
 * with numberDone=0 (via initialNumberDone) and save, resetting the player's
 * campaign progress to zero.
 *
 * The fix ensures that completedCampaign=false immediately returns an empty array
 * without any side effects.
 */
describe("Campaign.completeCampaignMissions", () => {
	const CAMPAIGN_MISSIONS: CampaignMission[] = [
		{
			missionId: "earnLifePoints",
			missionVariant: 0,
			missionObjective: 100,
			gemsToWin: 5,
			xpToWin: 50,
			moneyToWin: 100
		},
		{
			missionId: "earnMoney",
			missionVariant: 0,
			missionObjective: 500,
			gemsToWin: 10,
			xpToWin: 100,
			moneyToWin: 200
		},
		{
			missionId: "findItem",
			missionVariant: 1,
			missionObjective: 3,
			gemsToWin: 15,
			xpToWin: 150,
			moneyToWin: 300
		}
	];

	let player: Player;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock CampaignData.getMissions to return our test missions
		vi.spyOn(CampaignData, "getMissions").mockReturnValue(CAMPAIGN_MISSIONS);

		// Create mock player
		player = Object.create(Player.prototype);
		Object.assign(player, {
			id: 1,
			keycloakId: "test-keycloak-id"
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Creates a mock MissionSlot that behaves like the real model
	 */
	function createMockCampaignSlot(overrides: Partial<{
		missionId: string;
		missionVariant: number;
		missionObjective: number;
		numberDone: number;
		gemsToWin: number;
		xpToWin: number;
		moneyToWin: number;
	}> = {}): MissionSlot {
		const slot = Object.create(MissionSlot.prototype);
		Object.assign(slot, {
			missionId: overrides.missionId ?? "earnLifePoints",
			missionVariant: overrides.missionVariant ?? 0,
			missionObjective: overrides.missionObjective ?? 100,
			numberDone: overrides.numberDone ?? 0,
			gemsToWin: overrides.gemsToWin ?? 5,
			xpToWin: overrides.xpToWin ?? 50,
			moneyToWin: overrides.moneyToWin ?? 100,
			expiresAt: null, // Campaign missions have no expiry
			saveBlob: null,
			save: vi.fn().mockResolvedValue(undefined),
			toJSON: function() {
				return { ...this };
			}
		});
		return slot as MissionSlot;
	}

	/**
	 * Creates a mock PlayerMissionsInfo
	 */
	function createMockMissionInfo(overrides: Partial<{
		campaignBlob: string;
		campaignProgression: number;
	}> = {}): PlayerMissionsInfo {
		const info = Object.create(PlayerMissionsInfo.prototype);
		Object.assign(info, {
			playerId: 1,
			campaignBlob: overrides.campaignBlob ?? "000", // 3 missions, none completed
			campaignProgression: overrides.campaignProgression ?? 1, // Currently on mission 1
			save: vi.fn().mockResolvedValue(undefined)
		});
		return info as PlayerMissionsInfo;
	}

	describe("Regression: completedCampaign=false must not modify campaign state (#3973 / #3868)", () => {
		it("should return empty array immediately when completedCampaign is false", async () => {
			const campaign = createMockCampaignSlot({
				numberDone: 50,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			const result = await Campaign.completeCampaignMissions(player, missionInfo, false, campaign);

			expect(result).toEqual([]);
		});

		it("should NOT save the campaign slot when completedCampaign is false", async () => {
			const campaign = createMockCampaignSlot({
				numberDone: 50,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo();

			await Campaign.completeCampaignMissions(player, missionInfo, false, campaign);

			expect(campaign.save).not.toHaveBeenCalled();
			expect(missionInfo.save).not.toHaveBeenCalled();
		});

		it("should NOT modify numberDone when completedCampaign is false", async () => {
			const campaign = createMockCampaignSlot({
				numberDone: 75,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			await Campaign.completeCampaignMissions(player, missionInfo, false, campaign);

			// The critical assertion: numberDone must remain unchanged
			expect(campaign.numberDone).toBe(75);
		});

		it("should NOT modify campaignBlob when completedCampaign is false", async () => {
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});
			const campaign = createMockCampaignSlot();

			await Campaign.completeCampaignMissions(player, missionInfo, false, campaign);

			expect(missionInfo.campaignBlob).toBe("000");
			expect(missionInfo.campaignProgression).toBe(1);
		});

		it("should NOT modify campaign even when mission appears completed and completedCampaign is false", async () => {
			// This is THE scenario that caused bug #3973:
			// The campaign slot looks completed (numberDone >= objective),
			// but completedCampaign is false because it was triggered by a recursive call
			// from a daily mission sharing the same objective type
			const campaign = createMockCampaignSlot({
				numberDone: 100,
				missionObjective: 100 // isCompleted() would return true
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			expect(campaign.isCompleted()).toBe(true); // Sanity check

			const result = await Campaign.completeCampaignMissions(player, missionInfo, false, campaign);

			// Even though mission looks completed, completedCampaign=false means
			// we must not process it — it was not the campaign that was completed
			expect(result).toEqual([]);
			expect(campaign.save).not.toHaveBeenCalled();
			expect(missionInfo.save).not.toHaveBeenCalled();
			expect(missionInfo.campaignBlob).toBe("000");
		});
	});

	describe("Normal completion: completedCampaign=true", () => {
		it("should record completion and advance progression for a single completed mission", async () => {
			const campaign = createMockCampaignSlot({
				missionId: "earnLifePoints",
				numberDone: 100,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			// Mock initialNumberDone for the next mission (earnMoney) — player starts at 0
			vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue({
				initialNumberDone: vi.fn().mockResolvedValue(0)
			} as never);

			const result = await Campaign.completeCampaignMissions(player, missionInfo, true, campaign);

			expect(result).toHaveLength(1);
			expect(result[0].missionId).toBe("earnLifePoints");

			// Campaign blob should mark mission 1 as completed
			expect(missionInfo.campaignBlob).toBe("100");
			// Progression should advance to mission 2
			expect(missionInfo.campaignProgression).toBe(2);
			// Campaign slot should be saved with the next mission's data
			expect(campaign.save).toHaveBeenCalled();
			expect(missionInfo.save).toHaveBeenCalled();
		});

		it("should handle chain completion when next mission is already completed via initialNumberDone", async () => {
			const campaign = createMockCampaignSlot({
				missionId: "earnLifePoints",
				numberDone: 100,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			// The next mission (earnMoney, objective=500) has initialNumberDone=500
			// meaning the player already qualifies → chain completion
			// The mission after that (findItem, objective=3) has initialNumberDone=0
			vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue({
				initialNumberDone: vi.fn()
					.mockResolvedValueOnce(500) // earnMoney: already completed
					.mockResolvedValueOnce(0) // findItem: not yet completed
			} as never);

			const result = await Campaign.completeCampaignMissions(player, missionInfo, true, campaign);

			// Both missions should be completed (chain)
			expect(result).toHaveLength(2);
			expect(result[0].missionId).toBe("earnLifePoints");
			expect(result[1].missionId).toBe("earnMoney");

			// Campaign blob should mark first two missions as completed
			expect(missionInfo.campaignBlob).toBe("110");
			// Progression should be on mission 3
			expect(missionInfo.campaignProgression).toBe(3);
		});

		it("should return empty array when mission is not yet completed", async () => {
			const campaign = createMockCampaignSlot({
				numberDone: 50,
				missionObjective: 100 // Not completed: 50 < 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "000",
				campaignProgression: 1
			});

			const result = await Campaign.completeCampaignMissions(player, missionInfo, true, campaign);

			expect(result).toEqual([]);
			expect(campaign.save).not.toHaveBeenCalled();
			expect(missionInfo.save).not.toHaveBeenCalled();
		});

		it("should handle completing the last campaign mission", async () => {
			const campaign = createMockCampaignSlot({
				missionId: "findItem",
				missionVariant: 1,
				numberDone: 3,
				missionObjective: 3
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "110", // First two already done
				campaignProgression: 3 // On the last mission
			});

			const result = await Campaign.completeCampaignMissions(player, missionInfo, true, campaign);

			expect(result).toHaveLength(1);
			expect(result[0].missionId).toBe("findItem");

			// All missions completed
			expect(missionInfo.campaignBlob).toBe("111");
			// Progression should be 0 (no next campaign)
			expect(missionInfo.campaignProgression).toBe(0);
			expect(campaign.save).toHaveBeenCalled();
		});
	});

	describe("Edge cases", () => {
		it("should correctly handle completedCampaign=true when all campaign missions are already done", async () => {
			const campaign = createMockCampaignSlot({
				numberDone: 50,
				missionObjective: 100
			});
			const missionInfo = createMockMissionInfo({
				campaignBlob: "111", // All done
				campaignProgression: 0
			});

			const result = await Campaign.completeCampaignMissions(player, missionInfo, true, campaign);

			expect(result).toEqual([]);
		});
	});
});
