import {
	describe, expect, it, vi
} from "vitest";
import {
	assertPlayerHasNoPendingChanges, MissionsController, PLAYER_RESYNC_CALLERS, UnsavedPlayerChangesError
} from "../../../src/core/missions/MissionsController";
import Player from "../../../src/core/database/game/models/Player";
import MissionSlot, { MissionSlots } from "../../../src/core/database/game/models/MissionSlot";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { Campaign } from "../../../src/core/missions/Campaign";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { IMission } from "../../../src/core/missions/IMission";
import { missionInterface as defaultMissionInterface } from "../../../src/core/missions/DefaultInterface";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "../../../../Lib/src/packets/events/MissionsExpiredPacket";
import {
	CompletedMission, MissionType
} from "../../../../Lib/src/types/CompletedMission";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	RecipeDiscoverySource, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import { RecipeDisplayInfo } from "../../../../Lib/src/types/CookingTypes";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { LockedRowNotFoundError } from "../../../../Lib/src/locks/withLockedEntities";
import { FightActionController } from "../../../src/core/fights/actions/FightActionController";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import {
	Mission, MissionDataController
} from "../../../src/data/Mission";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";
import {
	buildDailyMission, buildMissionInfo, buildMissionSlot, buildPlayer, completedPackets, DAY_MS, expiredPackets, KEYCLOAK_ID, MONEY_BLESSING_MULTIPLIER, PLAYER_ID, SCORE_MULTIPLIER, setupMissionsControllerHarness
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
 * Mission whose params match when `params.target` equals the variant, and whose blob lists the received targets
 */
const targetedMission: IMission = {
	generateRandomVariant: () => 0,
	areParamsMatchingVariantAndBlob: (variant, params) => params.target === variant,
	initialNumberDone: () => 0,
	updateSaveBlob: (_variant, saveBlob, params) => Buffer.from(`${saveBlob ? `${saveBlob.toString()},` : ""}${String(params.target)}`)
};

/**
 * Same as {@link targetedMission}, but its blob records every received target, even the ones not matching
 */
const alwaysBlobMission: IMission = {
	...targetedMission,
	alwaysUpdateBlob: true
};

/**
 * Mission whose blob never changes
 */
const constantBlobMission: IMission = {
	...targetedMission,
	updateSaveBlob: (_variant, saveBlob) => saveBlob
};

describe("MissionsController", () => {
	const harness = setupMissionsControllerHarness(mocks, {
		targeted: targetedMission,
		alwaysBlob: alwaysBlobMission,
		constantBlob: constantBlobMission
	});

	describe("mission interfaces", () => {
		it("loads the interfaces exported by the files of the interfaces folder", async () => {
			mocks.importCompiledFolderExports.mockClear();

			await MissionsController.loadMissionInterfaces();

			expect(mocks.importCompiledFolderExports).toHaveBeenCalledWith("core/missions/interfaces", expect.any(Function));
			expect(MissionsController.getMissionInterface("alwaysBlob")).toBe(alwaysBlobMission);
		});

		it("uses the default interface for a mission without its own file", () => {
			expect(MissionsController.getMissionInterface("earnMoney")).toBe(defaultMissionInterface);
		});
	});

	describe("assertPlayerHasNoPendingChanges", () => {
		it("rejects a player with unsaved changes, naming the caller, the player and the fields", () => {
			const player = buildPlayer();
			player.money = 10;
			player.level = 3;

			expect(() => assertPlayerHasNoPendingChanges(player, PLAYER_RESYNC_CALLERS.MUTATE_LOCKED))
				.toThrow(new UnsavedPlayerChangesError(PLAYER_RESYNC_CALLERS.MUTATE_LOCKED, PLAYER_ID, ["money", "level"]));
			expect(() => assertPlayerHasNoPendingChanges(player, PLAYER_RESYNC_CALLERS.UPDATE))
				.toThrow(`MissionsController.update: player ${PLAYER_ID} has unsaved changes: money, level`);
		});

		it("accepts a player without pending change", () => {
			expect(() => assertPlayerHasNoPendingChanges(buildPlayer(), PLAYER_RESYNC_CALLERS.UPDATE)).not.toThrow();
		});

		it("names its error after its class", () => {
			expect(new UnsavedPlayerChangesError(PLAYER_RESYNC_CALLERS.UPDATE, 1, ["money"]).name).toBe("UnsavedPlayerChangesError");
		});
	});

	describe("update: lock and caller synchronization", () => {
		it("locks the player and its mission info rows of the caller", async () => {
			await MissionsController.update(buildPlayer(), [], { missionId: "targeted" });

			const [keys] = mocks.withLockedEntities.mock.calls[0];
			expect(keys).toEqual([Player.lockKey(PLAYER_ID), PlayerMissionsInfo.lockKey(PLAYER_ID)]);
			expect(PlayerMissionsInfos.getOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("applies the mutation on the locked player before resolving the count, saves it and synchronizes the caller", async () => {
			const caller = buildPlayer({ money: 100 });
			harness.locked.player = buildPlayer({ money: 250 });
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnMoney",
				missionObjective: 10000
			})];

			const result = await MissionsController.update(caller, [], {
				missionId: "earnMoney",
				count: lockedPlayer => lockedPlayer.money,
				applyOnLockedPlayer: lockedPlayer => {
					lockedPlayer.money += 50;
				}
			});

			expect(result).toBe(caller);
			expect(caller.money).toBe(300);
			expect(harness.missionSlots[0].numberDone).toBe(300);
			expect(harness.queries.playerSave).toHaveBeenCalled();
			expect(harness.locked.player.changed()).toBe(false);
		});

		it("skips the update and keeps the caller when a locked row vanished", async () => {
			const caller = buildPlayer({ money: 100 });
			const warn = vi.spyOn(CrowniclesLogger, "warn").mockImplementation(() => undefined);
			mocks.withLockedEntities.mockRejectedValue(new LockedRowNotFoundError("players", PLAYER_ID));

			const result = await MissionsController.update(caller, [], { missionId: "earnMoney" });

			expect(result).toBe(caller);
			expect(caller.money).toBe(100);
			expect(warn).toHaveBeenCalledWith(`MissionsController.update: locked row vanished for player ${PLAYER_ID} — skipping mission update`);
		});

		it("propagates the other errors of the critical section", async () => {
			mocks.withLockedEntities.mockRejectedValue(new Error("deadlock"));

			await expect(MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" })).rejects.toThrow("deadlock");
			await expect(MissionsController.updateMultiple(buildPlayer(), [], [{ missionId: "earnMoney" }])).rejects.toThrow("deadlock");
		});
	});

	describe("update: mission slots progress", () => {
		it("progresses by one by default, and only the slots of the updated mission", async () => {
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "earnMoney", missionObjective: 10, numberDone: 2
				}),
				buildMissionSlot({
					id: 2, missionId: "earnXP", missionObjective: 10, numberDone: 2
				})
			];

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			expect(harness.missionSlots.map(slot => slot.numberDone)).toEqual([3, 2]);
			expect(harness.queries.missionSlotSave).toHaveBeenCalledTimes(1);
		});

		it("adds the count to the progress, capped by the objective", async () => {
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "earnMoney", missionObjective: 10, numberDone: 2
				}),
				buildMissionSlot({
					id: 2, missionId: "earnMoney", missionObjective: 100, numberDone: 2
				})
			];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "earnMoney",
				count: 30
			});

			expect(harness.missionSlots.map(slot => slot.numberDone)).toEqual([10, 32]);
		});

		it("replaces the progress by the count in set mode, capped by the objective", async () => {
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "reachLevel", missionObjective: 10, numberDone: 2
				}),
				buildMissionSlot({
					id: 2, missionId: "reachLevel", missionObjective: 100, numberDone: 2
				})
			];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "reachLevel",
				count: 30,
				set: true
			});

			expect(harness.missionSlots.map(slot => slot.numberDone)).toEqual([10, 30]);
		});

		it("does not progress a completed slot", async () => {
			const completedCampaign = buildMissionSlot({
				missionId: "earnMoney", missionObjective: 5, numberDone: 5, expiresAt: null
			});
			harness.missionSlots = [completedCampaign];

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			expect(completedCampaign.numberDone).toBe(5);
			expect(harness.queries.missionSlotSave).not.toHaveBeenCalled();
		});

		it("only progresses the slots whose variant matches the params, and records the blob of the matching ones", async () => {
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "targeted", missionVariant: 7, missionObjective: 10
				}),
				buildMissionSlot({
					id: 2, missionId: "targeted", missionVariant: 8, missionObjective: 10
				})
			];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "targeted",
				params: { target: 7 }
			});

			expect(harness.missionSlots.map(slot => slot.numberDone)).toEqual([1, 0]);
			expect(harness.missionSlots.map(slot => slot.saveBlob?.toString() ?? null)).toEqual(["7", null]);
		});

		it("records the blob of a mission that always updates it, even when the params do not match", async () => {
			const slot = buildMissionSlot({
				missionId: "alwaysBlob", missionVariant: 8, missionObjective: 10
			});
			harness.missionSlots = [slot];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "alwaysBlob",
				params: { target: 7 }
			});

			expect(slot.numberDone).toBe(0);
			expect(slot.saveBlob?.toString()).toBe("7");
			expect(harness.queries.missionSlotSave).toHaveBeenCalledTimes(1);
		});

		it("no longer records the blob of a completed mission", async () => {
			const slot = buildMissionSlot({
				missionId: "alwaysBlob", missionVariant: 7, missionObjective: 1, numberDone: 1, expiresAt: null
			});
			harness.missionSlots = [slot];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "alwaysBlob",
				params: { target: 7 }
			});

			expect(slot.saveBlob).toBeNull();
		});

		it("does not save a slot whose blob did not change", async () => {
			const blob = Buffer.from("7");
			const slot = buildMissionSlot({
				missionId: "constantBlob", missionVariant: 7, missionObjective: 10, saveBlob: blob
			});
			harness.missionSlots = [slot];

			await MissionsController.update(buildPlayer(), [], {
				missionId: "constantBlob",
				params: { target: 7 },
				count: 0
			});

			expect(slot.saveBlob).toBe(blob);
			expect(harness.queries.missionSlotSave).toHaveBeenCalledTimes(1);
		});
	});

	describe("update: expired missions", () => {
		it("removes the expired missions, reports them and does not progress them", async () => {
			const expiresAt = new Date(Date.now() - DAY_MS);
			const expired = buildMissionSlot({
				id: 1, missionId: "earnMoney", missionVariant: 3, missionObjective: 10, numberDone: 4, expiresAt
			});
			const active = buildMissionSlot({
				id: 2, missionId: "earnXP", missionObjective: 10
			});
			harness.missionSlots = [expired, active];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(expired.numberDone).toBe(4);
			expect(harness.queries.missionSlotDestroy).toHaveBeenCalledTimes(1);
			expect(harness.queries.missionSlotDestroy.mock.contexts[0]).toBe(expired);
			expect(harness.logs.logMissionFailed).toHaveBeenCalledWith(KEYCLOAK_ID, "earnMoney", 3, 10);
			const packets = expiredPackets(response);
			expect(packets).toHaveLength(1);
			expect(packets[0].keycloakId).toBe(KEYCLOAK_ID);
			expect(packets[0].missions).toEqual([{
				missionId: "earnMoney",
				missionObjective: 10,
				missionVariant: 3,
				numberDone: 4,
				saveBlob: undefined,
				missionType: MissionType.NORMAL,
				expiresAt: expiresAt.toString()
			}]);
		});

		it("does not report anything when no mission expired", async () => {
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10
			})];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(expiredPackets(response)).toHaveLength(0);
			expect(harness.queries.missionSlotDestroy).not.toHaveBeenCalled();
			expect(harness.queries.playerSave).toHaveBeenCalledTimes(2);
		});

		it("saves the player when missions expired", async () => {
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10, expiresAt: new Date(Date.now() - DAY_MS)
			})];

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			// Once for the expired missions, once after completing the missions and once at the end of the update
			expect(harness.queries.playerSave).toHaveBeenCalledTimes(3);
		});
	});

	describe("update: completed missions", () => {
		function secondaryMission(id: number, values: Partial<Parameters<typeof buildMissionSlot>[0]> = {}): MissionSlot {
			return buildMissionSlot({
				id,
				missionId: "earnMoney",
				missionVariant: id,
				missionObjective: 1,
				gemsToWin: 3,
				xpToWin: 10 * id,
				moneyToWin: 100 * id,
				pointsToWin: 15 * id,
				...values
			});
		}

		it("does nothing more when no mission is completed", async () => {
			harness.missionSlots = [secondaryMission(1, { missionObjective: 5 })];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(completedPackets(response)).toHaveLength(0);
			expect(harness.queries.missionSlotDestroy).not.toHaveBeenCalled();
			expect(harness.rewards.money).toHaveLength(0);
			expect(RecipeDiscoveryService.syncProgressionRecipes).not.toHaveBeenCalled();
			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledWith(false, harness.locked.player, harness.locked.missionInfo);
		});

		it("removes the completed secondary missions and grants the sum of their rewards, without gems", async () => {
			harness.missionSlots = [secondaryMission(1), secondaryMission(2)];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(harness.queries.missionSlotDestroy).toHaveBeenCalledTimes(2);
			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledWith(false, harness.locked.player, harness.locked.missionInfo);
			expect(harness.logs.logMissionFinished).toHaveBeenCalledWith(KEYCLOAK_ID, "earnMoney", 1, 1);
			expect(harness.logs.logMissionFinished).toHaveBeenCalledWith(KEYCLOAK_ID, "earnMoney", 2, 1);
			expect(harness.rewards.gems).toEqual([{
				amount: 0, keycloakId: KEYCLOAK_ID, reason: NumberChangeReason.MISSION_FINISHED
			}]);
			expect(harness.rewards.experience).toEqual([{
				amount: 30, response, reason: NumberChangeReason.MISSION_FINISHED
			}]);
			expect(harness.rewards.money).toEqual([{
				amount: 300, response, reason: NumberChangeReason.MISSION_FINISHED
			}]);
			expect(harness.rewards.score).toEqual([{
				amount: 45, response, reason: NumberChangeReason.MISSION_FINISHED
			}]);
		});

		it("reports the completed missions with the blessings applied on the money and the points shown", async () => {
			harness.missionSlots = [secondaryMission(1, { pointsToWin: 15 })];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			const packets = completedPackets(response);
			expect(packets).toHaveLength(1);
			expect(packets[0].keycloakId).toBe(KEYCLOAK_ID);
			expect(packets[0].nextCampaignMission).toBeUndefined();
			expect(packets[0].discoveredRecipes).toBeUndefined();
			expect(packets[0].missions).toHaveLength(1);
			expect(packets[0].missions[0]).toMatchObject({
				missionId: "earnMoney",
				missionType: MissionType.NORMAL,
				gemsToWin: 0,
				xpToWin: 10,
				moneyToWin: 100 * MONEY_BLESSING_MULTIPLIER,
				pointsToWin: Math.round(15 * SCORE_MULTIPLIER)
			});
		});

		it("grants the rewards of the campaign missions completed by the update and shows the next one", async () => {
			const campaign = secondaryMission(1, {
				missionObjective: 2, numberDone: 1, expiresAt: null
			});
			harness.missionSlots = [campaign];
			harness.campaignMissions = [{
				...campaign.toJSON(),
				missionType: MissionType.CAMPAIGN,
				gemsToWin: 4,
				pointsToWin: 0
			} as CompletedMission];
			harness.campaignSlot = buildMissionSlot({
				missionId: "earnXP", missionVariant: 2, missionObjective: 50, numberDone: 3, expiresAt: null
			});
			harness.locked.missionInfo.campaignBlob = "1101000";
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledWith(true, harness.locked.player, harness.locked.missionInfo);
			expect(harness.queries.missionSlotDestroy).not.toHaveBeenCalled();
			expect(harness.rewards.gems.map(gems => gems.amount)).toEqual([4]);
			expect(RecipeDiscoveryService.syncProgressionRecipes).toHaveBeenCalledWith(harness.locked.player, RecipeDiscoverySource.CAMPAIGN_MILESTONE, 3);
			const [packet] = completedPackets(response);
			expect(packet.missions.map(mission => mission.missionType)).toEqual([MissionType.CAMPAIGN]);
			expect(packet.nextCampaignMission).toEqual({
				missionId: "earnXP",
				missionObjective: 50,
				missionVariant: 2,
				numberDone: 3,
				saveBlob: undefined,
				missionType: MissionType.CAMPAIGN,
				expiresAt: undefined
			});
		});

		it("does not show a next campaign mission when the campaign is finished", async () => {
			const campaign = secondaryMission(1, {
				missionObjective: 2, numberDone: 1, expiresAt: null
			});
			harness.missionSlots = [campaign];
			harness.campaignMissions = [{
				...campaign.toJSON(), missionType: MissionType.CAMPAIGN
			} as CompletedMission];
			harness.campaignSlot = buildMissionSlot({
				missionId: "earnXP", missionObjective: 5, numberDone: 5, expiresAt: null
			});
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(completedPackets(response)[0].nextCampaignMission).toBeUndefined();
		});

		it("shows the next campaign mission when secondary missions are completed with the campaign one", async () => {
			const campaign = secondaryMission(1, {
				missionObjective: 2, numberDone: 1, expiresAt: null
			});
			harness.missionSlots = [campaign, secondaryMission(2)];
			harness.campaignMissions = [{
				...campaign.toJSON(), missionType: MissionType.CAMPAIGN
			} as CompletedMission];
			harness.campaignSlot = buildMissionSlot({
				missionId: "earnXP", missionObjective: 50, expiresAt: null
			});
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(completedPackets(response)[0].nextCampaignMission?.missionId).toBe("earnXP");
		});

		it("does not complete the campaign when its mission only progresses", async () => {
			harness.missionSlots = [secondaryMission(1, {
				missionObjective: 5, expiresAt: null
			})];

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledWith(false, harness.locked.player, harness.locked.missionInfo);
		});

		it("does not look for a next campaign mission when only secondary missions are completed", async () => {
			harness.missionSlots = [secondaryMission(1)];
			harness.campaignSlot = buildMissionSlot({
				missionId: "earnXP", missionObjective: 50, expiresAt: null
			});
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(completedPackets(response)[0].nextCampaignMission).toBeUndefined();
			expect(MissionSlots.getCampaignOfPlayer).not.toHaveBeenCalled();
		});

		it("reports the recipes discovered by the campaign progress", async () => {
const recipes: RecipeDisplayInfo[] = [{
				recipeId: "potion_health_1", level: 1, recipeType: RecipeType.POTION_HEALTH
			}];
			vi.mocked(RecipeDiscoveryService.syncProgressionRecipes).mockResolvedValue(recipes);
			harness.missionSlots = [secondaryMission(1)];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(completedPackets(response)[0].discoveredRecipes).toEqual(recipes);
		});

		it("gives the pet rewarded by a completed campaign mission", async () => {
			const giveToPlayer = vi.fn().mockResolvedValue(undefined);
			// Only the adoption of the created pet is used by the campaign reward
			const createPet = vi.spyOn(PetEntities, "createPet").mockReturnValue({ giveToPlayer } as unknown as ReturnType<typeof PetEntities.createPet>);
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(values => values[1]);
			const campaign = secondaryMission(1, {
				missionObjective: 2, numberDone: 1, expiresAt: null
			});
			harness.missionSlots = [campaign];
			harness.campaignMissions = [{
				...campaign.toJSON(), missionType: MissionType.CAMPAIGN, petRewardTypeId: 12
			} as CompletedMission];
			const response: CrowniclesPacket[] = [];

			await MissionsController.update(buildPlayer(), response, { missionId: "earnMoney" });

			expect(createPet).toHaveBeenCalledTimes(1);
			expect(createPet).toHaveBeenCalledWith(12, PetConstants.SEX.FEMALE, "");
			expect(RandomUtils.crowniclesRandom.pick).toHaveBeenCalledWith([PetConstants.SEX.MALE, PetConstants.SEX.FEMALE]);
			expect(giveToPlayer).toHaveBeenCalledWith(harness.locked.player, response);
			const packetIndex = response.findIndex(packet => packet instanceof MissionsCompletedPacket);
			expect(packetIndex).toBeGreaterThanOrEqual(0);
		});

		it("does not give a pet for the missions without pet reward", async () => {
			const createPet = vi.spyOn(PetEntities, "createPet");
			harness.missionSlots = [secondaryMission(1)];

			await MissionsController.update(buildPlayer(), [], { missionId: "earnMoney" });

			expect(createPet).not.toHaveBeenCalled();
		});
	});

	describe("updateMultiple", () => {
		it("applies every update, with its own mutation, count and params", async () => {
			const caller = buildPlayer({ money: 10 });
			harness.locked.player = buildPlayer({ money: 10 });
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "earnMoney", missionObjective: 1000
				}),
				buildMissionSlot({
					id: 2, missionId: "reachLevel", missionObjective: 1000, numberDone: 400
				}),
				buildMissionSlot({
					id: 3, missionId: "targeted", missionVariant: 4, missionObjective: 1000
				}),
				buildMissionSlot({
					id: 4, missionId: "earnXP", missionObjective: 1000, numberDone: 3
				})
			];

			const result = await MissionsController.updateMultiple(caller, [], [
				{
					missionId: "earnMoney",
					count: lockedPlayer => lockedPlayer.money,
					applyOnLockedPlayer: lockedPlayer => {
						lockedPlayer.money += 5;
					}
				},
				{
					missionId: "reachLevel",
					count: 7,
					set: true
				},
				{
					missionId: "targeted",
					params: { target: 4 }
				},
				{ missionId: "earnXP" }
			]);

			expect(result).toBe(caller);
			expect(caller.money).toBe(15);
			expect(harness.missionSlots.map(slot => slot.numberDone)).toEqual([15, 7, 1, 4]);
			expect(harness.queries.playerSave).toHaveBeenCalled();
			expect(harness.locked.player.changed()).toBe(false);
		});

		it("evaluates the campaign once every count is applied", async () => {
			harness.missionSlots = [
				buildMissionSlot({
					id: 1, missionId: "earnMoney", missionObjective: 1, expiresAt: null
				}),
				buildMissionSlot({
					id: 2, missionId: "earnXP", missionObjective: 10
				})
			];

			await MissionsController.updateMultiple(buildPlayer(), [], [{ missionId: "earnMoney" }, { missionId: "earnXP" }]);

			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledTimes(1);
			expect(Campaign.updatePlayerCampaign).toHaveBeenCalledWith(true, harness.locked.player, harness.locked.missionInfo);
		});

		it("completes the daily mission progressed by any update of the batch, but not the campaign", async () => {
			harness.dailyMission = buildDailyMission({
				missionId: "earnMoney", missionObjective: 1
			});
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10, expiresAt: null
			})];
			const response: CrowniclesPacket[] = [];

			await MissionsController.updateMultiple(buildPlayer(), response, [{ missionId: "earnMoney" }, { missionId: "earnXP" }]);

			expect(completedPackets(response).flatMap(packet => packet.missions)
				.map(mission => mission.missionType)).toEqual([MissionType.DAILY]);
			expect(Campaign.updatePlayerCampaign).toHaveBeenLastCalledWith(false, harness.locked.player, harness.locked.missionInfo);
		});

		it("reports the expired missions once for the whole batch", async () => {
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10, expiresAt: new Date(Date.now() - DAY_MS)
			})];
			const response: CrowniclesPacket[] = [];

			await MissionsController.updateMultiple(buildPlayer(), response, [{ missionId: "earnMoney" }, { missionId: "earnXP" }]);

			expect(expiredPackets(response)).toHaveLength(1);
			expect(harness.missionSlots[0].numberDone).toBe(0);
		});

		it("runs the follow-up on the updated player and adds its packets once committed, after the batch ones", async () => {
			const caller = buildPlayer({ money: 10 });
			harness.locked.player = buildPlayer({ money: 10 });
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10, expiresAt: new Date(Date.now() - DAY_MS)
			})];
			const previousPacket = new MissionsExpiredPacket();
			const response: CrowniclesPacket[] = [previousPacket];
			const followUpPacket = new MissionsCompletedPacket();
			let followUpPlayerMoney: number | undefined;
			let responseLengthDuringFollowUp: number | undefined;

			const result = await MissionsController.updateMultiple(caller, response, [{
				missionId: "earnMoney",
				applyOnLockedPlayer: lockedPlayer => {
					lockedPlayer.money += 5;
				}
			}], (lockedPlayer, batchResponse) => {
				followUpPlayerMoney = lockedPlayer.money;
				responseLengthDuringFollowUp = response.length;
				batchResponse.push(followUpPacket);
				return Promise.resolve();
			});

			expect(result).toBe(caller);
			expect(caller.money).toBe(15);
			expect(followUpPlayerMoney).toBe(15);
			expect(responseLengthDuringFollowUp).toBe(1);
			expect(response).toHaveLength(3);
			expect(response[0]).toBe(previousPacket);
			expect(response[1]).toBeInstanceOf(MissionsExpiredPacket);
			expect(response[2]).toBe(followUpPacket);
		});

		it("drops the packets of the batch when its follow-up fails", async () => {
			harness.missionSlots = [buildMissionSlot({
				missionId: "earnXP", missionObjective: 10, expiresAt: new Date(Date.now() - DAY_MS)
			})];
			const response: CrowniclesPacket[] = [];

			await expect(MissionsController.updateMultiple(buildPlayer(), response, [{ missionId: "earnMoney" }], () => Promise.reject(new Error("follow-up failed"))))
				.rejects.toThrow("follow-up failed");

			expect(response).toHaveLength(0);
		});

		it("skips the batch and keeps the caller when a locked row vanished", async () => {
			const caller = buildPlayer();
			const warn = vi.spyOn(CrowniclesLogger, "warn").mockImplementation(() => undefined);
			mocks.withLockedEntities.mockRejectedValue(new LockedRowNotFoundError("players", PLAYER_ID));

			expect(await MissionsController.updateMultiple(caller, [], [{ missionId: "earnMoney" }])).toBe(caller);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("MissionsController.updateMultiple"));
		});
	});

	describe("lock guards", () => {
		it("refuses to update the missions outside of the mission lock", async () => {
			const player = buildPlayer();
			const missionInfo = buildMissionInfo();
			const dailyMission = buildDailyMission();
			const completion = {
				daily: false, campaign: false
			};

			await expect(MissionsController.checkCompletedMissionsUnderLock(player, [], missionInfo, [], completion, dailyMission))
				.rejects.toThrow("MissionsController.checkCompletedMissionsUnderLock");
			await expect(MissionsController.completeAndUpdateMissionsUnderLock(player, [], missionInfo, completion, dailyMission))
				.rejects.toThrow("MissionsController.completeAndUpdateMissionsUnderLock");
			await expect(MissionsController.handleExpiredMissionsUnderLock(player, [], []))
				.rejects.toThrow("MissionsController.handleExpiredMissionsUnderLock");
		});
	});

	describe("prepareBaseMission", () => {
		it("shows the expiration date as a date string", () => {
			const expiresAt = new Date(Date.now() + DAY_MS);

			const [mission] = MissionsController.prepareBaseMissions([{
				missionId: "earnMoney",
				missionObjective: 1,
				missionVariant: 0,
				numberDone: 0,
				missionType: MissionType.NORMAL,
				expiresAt: expiresAt.toISOString()
			}]);

			expect(mission.expiresAt).toBe(expiresAt.toString());
			expect(mission.fightAction).toBeUndefined();
			expect(mission.mapType).toBeUndefined();
		});

		it("adds the fight action of the missions requiring one", () => {
			const fightActionId = "simpleAttack";
			const slot = buildMissionSlot({
				missionId: "fightAttacks",
				missionVariant: FightActionController.fightActionIdToVariant(fightActionId),
				missionObjective: 5,
				expiresAt: null
			});

			const mission = MissionsController.prepareMissionSlot(slot);

			expect(mission.fightAction).toBe(fightActionId);
			expect(mission.expiresAt).toBeUndefined();
		});

		it("adds no fight action when the variant matches none", () => {
			const mission = MissionsController.prepareMissionSlot(buildMissionSlot({
				missionId: "finishWithAttack", missionVariant: -12345, missionObjective: 5
			}));

			expect(mission).toHaveProperty("fightAction", undefined);
		});

		it("adds the map type of the place to go to", () => {
			const mapLocation = MapLocationDataController.instance.getById(1);
			const [mission] = MissionsController.prepareMissionSlots([buildMissionSlot({
				missionId: "goToPlace", missionVariant: 1, missionObjective: 1
			})]);

			expect(mapLocation).toBeDefined();
			expect(mission.mapType).toBe(mapLocation?.type);
		});
	});

	describe("mission generation", () => {
		function buildMission(values: Partial<Mission>): Mission {
			return Object.assign(new Mission(), {
				id: "targeted",
				campaignOnly: false,
				objectives: [10, 20, 30],
				gems: [1, 2, 3],
				xp: [11, 22, 33],
				points: [12, 24, 36],
				money: [13, 26, 39],
				expirations: [24, 48, 72],
				...values
			});
		}

		function pickLast(): void {
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(values => values[values.length - 1]);
		}

		it("does not generate an unknown mission", () => {
			expect(MissionsController.generateMissionProperties("unknownMission", MissionDifficulty.EASY, {})).toBeNull();
		});

		it("generates a mission of the requested difficulty, with the variant of its interface", () => {
			pickLast();
			const player = buildPlayer();
			const generateRandomVariant = vi.spyOn(targetedMission, "generateRandomVariant").mockReturnValue(17);
			const mission = buildMission({
				difficulties: {
					easy: [0], medium: [1, 2], hard: [2]
				}
			});

			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.EASY, {
				mission, player
			})).toEqual({
				mission, index: 0, variant: 17
			});
			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.MEDIUM, { mission })?.index).toBe(2);
			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.HARD, { mission })?.index).toBe(2);
			expect(generateRandomVariant).toHaveBeenCalledWith(MissionDifficulty.EASY, player);
		});

		it("does not generate a mission in a difficulty it does not offer", () => {
			const easyOnly = buildMission({ difficulties: { easy: [0] } });
			const mediumOnly = buildMission({ difficulties: { medium: [1] } });

			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.HARD, { mission: mediumOnly })).toBeNull();
			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.EASY, { mission: mediumOnly })).toBeNull();
			const hardOnly = buildMission({ difficulties: { hard: [2] } });

			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.MEDIUM, { mission: easyOnly })).toBeNull();
			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.HARD, { mission: easyOnly })).toBeNull();
			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.EASY, { mission: hardOnly })).toBeNull();
		});

		it("generates a daily mission from its daily indexes, whatever its difficulties", () => {
			pickLast();
			const mission = buildMission({
				difficulties: {}, dailyIndexes: [0, 1]
			});
			vi.spyOn(MissionDataController.instance, "getRandomDailyMission").mockReturnValue(mission);

			expect(MissionsController.generateRandomDailyMissionProperties()).toEqual({
				mission, index: 1, variant: 0
			});
		});

		it("reads the mission data when the mission is not given", () => {
			pickLast();
			const mission = buildMission({ difficulties: { easy: [1] } });
			const getById = vi.spyOn(MissionDataController.instance, "getById").mockReturnValue(mission);

			expect(MissionsController.generateMissionProperties("targeted", MissionDifficulty.EASY, {})?.index).toBe(1);
			expect(getById).toHaveBeenCalledWith("targeted");
		});

		it("adds a mission to the player with the objective, expiration and rewards of the generated index", async () => {
			pickLast();
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);
			const player = buildPlayer();
			const mission = buildMission({ difficulties: { medium: [1] } });
			vi.spyOn(MissionDataController.instance, "getById").mockReturnValue(mission);
			const generateRandomVariant = vi.spyOn(targetedMission, "generateRandomVariant").mockReturnValue(5);
			const initialNumberDone = vi.spyOn(targetedMission, "initialNumberDone").mockResolvedValue(6);
			const create = vi.spyOn(MissionSlot, "create").mockResolvedValue({ id: 77 } as MissionSlot);
			const createdSlot = buildMissionSlot({
				id: 77, missionId: "targeted", missionVariant: 5, missionObjective: 20
			});
			const getById = vi.spyOn(MissionSlots, "getById").mockResolvedValue(createdSlot);

			expect(await MissionsController.addMissionToPlayer(player, "targeted", MissionDifficulty.MEDIUM)).toBe(createdSlot);

			expect(create).toHaveBeenCalledWith({
				playerId: PLAYER_ID,
				missionId: "targeted",
				missionVariant: 5,
				missionObjective: 20,
				expiresAt: new Date(now + 48 * 60 * 60 * 1000),
				numberDone: 6,
				gemsToWin: 2,
				pointsToWin: 24,
				xpToWin: 22,
				moneyToWin: 26
			});
			expect(initialNumberDone).toHaveBeenCalledWith(player, 5);
			expect(generateRandomVariant).toHaveBeenCalledWith(MissionDifficulty.MEDIUM, player);
			expect(getById).toHaveBeenCalledWith(77);
			expect(harness.logs.logMissionFound).toHaveBeenCalledWith(KEYCLOAK_ID, "targeted", 5, 20);
		});

		it("adds a random mission of the difficulty, except the given one", async () => {
			const mission = buildMission({ difficulties: { hard: [2] } });
			const getRandomMission = vi.spyOn(MissionDataController.instance, "getRandomMission").mockReturnValue(mission);
			const addMissionToPlayer = vi.spyOn(MissionsController, "addMissionToPlayer").mockResolvedValue(buildMissionSlot({
				missionId: "targeted", missionObjective: 30
			}));
			const player = buildPlayer();

			await MissionsController.addRandomMissionToPlayer(player, MissionDifficulty.HARD, "earnMoney");
			await MissionsController.addRandomMissionToPlayer(player, MissionDifficulty.EASY);

			expect(getRandomMission).toHaveBeenNthCalledWith(1, MissionDifficulty.HARD, "earnMoney");
			expect(getRandomMission).toHaveBeenNthCalledWith(2, MissionDifficulty.EASY, "");
			expect(addMissionToPlayer).toHaveBeenCalledWith(player, "targeted", MissionDifficulty.HARD, mission);
		});

		it.each([
			[-1, 0.99, MissionDifficulty.EASY],
			[0, 0.99, MissionDifficulty.EASY],
			[9, 0.99, MissionDifficulty.EASY],
			[10, 0.74, MissionDifficulty.EASY],
			[10, 0.75, MissionDifficulty.MEDIUM],
			[20, 0.39, MissionDifficulty.EASY],
			[20, 0.4, MissionDifficulty.MEDIUM],
			[40, 0.89, MissionDifficulty.MEDIUM],
			[40, 0.9, MissionDifficulty.HARD],
			[59, 0.19, MissionDifficulty.EASY],
			[59, 0.74, MissionDifficulty.MEDIUM],
			[59, 0.75, MissionDifficulty.HARD],
			[60, 0.09, MissionDifficulty.EASY],
			[60, 0.49, MissionDifficulty.MEDIUM],
			[60, 0.5, MissionDifficulty.HARD]
		])("gives a player of level %i drawing %f a mission of difficulty %i", (level, draw, difficulty) => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneExclusive").mockReturnValue(draw);

			expect(MissionsController.getRandomDifficulty(buildPlayer({ level }))).toBe(difficulty);
		});

		// The draw excludes 1, which would not be below the summed probabilities (1) and would give a hard mission
		it("only gives easy missions to a low level player, even on the highest draw", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneExclusive").mockReturnValue(1 - Number.EPSILON);

			expect(MissionsController.getRandomDifficulty(buildPlayer({ level: 1 }))).toBe(MissionDifficulty.EASY);
		});
	});
});
