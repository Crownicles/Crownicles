import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";

type MissionsControllerModule = typeof import("../../src/core/missions/MissionsController");
type CampaignDataModule = typeof import("../../src/data/Campaign");

/**
 * Functional regression test for issue #4379.
 *
 * A single game action (finishing one dangerous expedition) fires several
 * mission updates in a row: `doExpeditions`, `longExpedition`,
 * `dangerousExpedition` and `expeditionStreak`. When `doExpeditions`
 * completes the current campaign mission and the next campaign mission is
 * "complete a dangerous expedition", the SAME expedition used to
 * retroactively complete that freshly-assigned mission — even though the
 * player finished the expedition before the mission was handed out.
 *
 * The fix routes all of an action's mission updates through
 * `MissionsController.updateMultiple`, which applies every progress count
 * to the current mission slots BEFORE advancing the campaign. The newly
 * assigned `dangerousExpedition` campaign mission must therefore stay at
 * `numberDone = 0`.
 */
describe("Expedition campaign mission ordering (issue #4379)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionsController: MissionsControllerModule["MissionsController"];
	let CampaignData: CampaignDataModule["CampaignData"];

	beforeAll(async () => {
		env = await setupCoreForTests("expeditioncampaignorder");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionsController = loadProductionModule<MissionsControllerModule>("core/missions/MissionsController").MissionsController;
		CampaignData = loadProductionModule<CampaignDataModule>("data/Campaign").CampaignData;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	/**
	 * Locate a `doExpeditions` campaign mission immediately followed (in
	 * completion order) by a later `dangerousExpedition` campaign mission.
	 * Every position in between is marked completed so `dangerousExpedition`
	 * is the very next mission handed out once `doExpeditions` completes.
	 */
	function findExpeditionChain(): { doIndex: number; dangerousIndex: number } {
		const missions = CampaignData.getMissions();
		const doIndex = missions.findIndex(mission => mission.missionId === "doExpeditions");
		const dangerousIndex = missions.findIndex((mission, index) => index > doIndex && mission.missionId === "dangerousExpedition");
		return {
			doIndex, dangerousIndex
		};
	}

	it("does not complete a freshly assigned dangerousExpedition campaign mission with the same expedition", async () => {
		const { doIndex, dangerousIndex } = findExpeditionChain();
		expect(doIndex).toBeGreaterThanOrEqual(0);
		expect(dangerousIndex).toBeGreaterThan(doIndex);

		const missions = CampaignData.getMissions();
		const doMission = missions[doIndex];
		const dangerousMission = missions[dangerousIndex];

		// Every campaign mission is already completed except doExpeditions and
		// dangerousExpedition, so dangerousExpedition is the next one handed out.
		const campaignBlobChars = Array.from({ length: missions.length }, () => "1");
		campaignBlobChars[doIndex] = "0";
		campaignBlobChars[dangerousIndex] = "0";

		const player = await Player.create({ keycloakId: "expedition-order-player" });
		await PlayerMissionsInfo.create({
			playerId: player.id,
			campaignBlob: campaignBlobChars.join(""),
			campaignProgression: doIndex + 1
		});

		// Current campaign mission: one expedition away from completing doExpeditions.
		await MissionSlot.create({
			playerId: player.id,
			missionId: doMission.missionId,
			missionVariant: doMission.missionVariant,
			missionObjective: doMission.missionObjective,
			numberDone: doMission.missionObjective - 1,
			expiresAt: null,
			gemsToWin: doMission.gemsToWin,
			pointsToWin: 0,
			xpToWin: doMission.xpToWin,
			moneyToWin: doMission.moneyToWin
		});

		const lockedPlayer = await Player.findOne({ where: { id: player.id } });
		const response: CrowniclesPacket[] = [];

		// Same order as PetExpeditionCommand.updateExpeditionMissions.
		await MissionsController.updateMultiple(lockedPlayer!, response, [
			{ missionId: "doExpeditions" },
			{
				missionId: "longExpedition",
				params: { durationMinutes: 100_000 }
			},
			{
				missionId: "dangerousExpedition",
				// Maximum risk: satisfies the mission's risk-category variant.
				params: { riskRate: 100 }
			},
			{ missionId: "expeditionStreak" }
		]);

		const campaignSlot = await MissionSlot.findOne({ where: { playerId: player.id, expiresAt: null } });
		expect(campaignSlot).not.toBeNull();

		// The campaign advanced to dangerousExpedition...
		expect(campaignSlot!.missionId).toBe("dangerousExpedition");
		expect(campaignSlot!.missionObjective).toBe(dangerousMission.missionObjective);

		// ...but it must NOT be completed by the very expedition that assigned it.
		expect(campaignSlot!.numberDone).toBe(0);
		expect(campaignSlot!.numberDone).toBeLessThan(campaignSlot!.missionObjective);

		const missionInfo = await PlayerMissionsInfo.findOne({ where: { playerId: player.id } });
		expect(missionInfo!.campaignProgression).toBe(dangerousIndex + 1);
	});
});
