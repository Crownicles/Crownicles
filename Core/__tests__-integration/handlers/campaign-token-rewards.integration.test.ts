import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type MissionsModule = typeof import("../../src/core/missions/MissionsController");
type CampaignModule = typeof import("../../src/data/Campaign");
type CompletedPacketsModule = typeof import("../../../Lib/src/packets/events/MissionsCompletedPacket");

describe("campaign token rewards", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let controller: MissionsModule["MissionsController"];
	let campaign: CampaignModule["CampaignData"];
	let packets: CompletedPacketsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("campaigntokens");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		MissionSlot = models.MissionSlot as ModelStatic<MissionSlotType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		controller = loadProductionModule<MissionsModule>("core/missions/MissionsController").MissionsController;
		campaign = loadProductionModule<CampaignModule>("data/Campaign").CampaignData;
		packets = loadProductionModule<CompletedPacketsModule>("../../Lib/src/packets/events/MissionsCompletedPacket");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({truncate: true, force: true});
			await PlayerMissionsInfo.destroy({truncate: true, force: true});
			await Player.destroy({truncate: true, force: true});
		} finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function seed(position: number, tokens: number): Promise<PlayerType> {
		const player = await Player.create({keycloakId: `campaign-tokens-${position}-${tokens}`, tokens, money: 0});
		const definitions = campaign.getMissions();
		const mission = definitions[position - 1];
		await PlayerMissionsInfo.create({
			playerId: player.id,
			campaignProgression: position,
			campaignBlob: "1".repeat(position - 1) + "0".repeat(definitions.length - position + 1)
		});
		await MissionSlot.create({...mission, playerId: player.id, numberDone: 0, expiresAt: null, pointsToWin: 0});
		return player;
	}

	it("credits the new introductory tokens once and announces the same reward", async () => {
		const player = await seed(1, 0);
		const response: CrowniclesPacket[] = [];
		await controller.update(player, response, {missionId: "commandMission"});

		await player.reload();
		expect(player.tokens).toBe(4);
		const info = await PlayerMissionsInfo.findByPk(player.id);
		expect(info?.campaignProgression).toBe(2);
		expect(info?.gems).toBe(1);
		const completed = response.filter(packet => packet instanceof packets.MissionsCompletedPacket);
		expect(completed).toHaveLength(1);
		expect(completed[0].missions[0]).toMatchObject({missionId: "commandMission", tokensToWin: 4, gemsToWin: 1, xpToWin: 10, moneyToWin: 0});
		expect(completed[0].nextCampaignMission).toMatchObject({missionId: "spendTokens", missionObjective: 1});

		const repeated: CrowniclesPacket[] = [];
		await controller.update(player, repeated, {missionId: "commandMission"});
		await player.reload();
		expect(player.tokens).toBe(4);
		expect(repeated.filter(packet => packet instanceof packets.MissionsCompletedPacket)).toHaveLength(0);
	});

	it("requires an actual token spend to complete mission two and keeps the next mission ready", async () => {
		const player = await seed(2, 4);
		await controller.update(player, [], {missionId: "commandReport"});
		expect((await PlayerMissionsInfo.findByPk(player.id))?.campaignProgression).toBe(2);

		const response: CrowniclesPacket[] = [];
		await player.useTokens({amount: 1, response, reason: NumberChangeReason.REPORT_TOKENS});
		await player.reload();
		expect(player.tokens).toBe(6);
		const info = await PlayerMissionsInfo.findByPk(player.id);
		expect(info?.campaignProgression).toBe(3);
		expect(info?.campaignBlob?.slice(0, 3)).toBe("110");
		const completed = response.filter(packet => packet instanceof packets.MissionsCompletedPacket);
		expect(completed[0].missions[0]).toMatchObject({missionId: "spendTokens", tokensToWin: 3});
		expect(completed[0].nextCampaignMission).toMatchObject({missionId: "earnMoney", missionObjective: 100});
	});

	it("does not announce token credits refused by the cap while preserving the other rewards", async () => {
		const player = await seed(1, TokensConstants.MAX);
		const response: CrowniclesPacket[] = [];
		await controller.update(player, response, {missionId: "commandMission"});
		await player.reload();
		expect(player.tokens).toBe(TokensConstants.MAX);
		expect((await PlayerMissionsInfo.findByPk(player.id))?.gems).toBe(1);
		const completed = response.filter(packet => packet instanceof packets.MissionsCompletedPacket);
		expect(completed[0].missions[0]).toMatchObject({tokensToWin: 0, gemsToWin: 1, xpToWin: 10, moneyToWin: 0});
	});

	it("announces exactly the persisted token gain when starting just below the cap", async () => {
		const initialTokens = TokensConstants.MAX - 1;
		const player = await seed(1, initialTokens);
		const response: CrowniclesPacket[] = [];
		await controller.update(player, response, {missionId: "commandMission"});
		await player.reload();
		const completed = response.filter(packet => packet instanceof packets.MissionsCompletedPacket);
		expect(player.tokens).toBeGreaterThan(initialTokens);
		expect(completed[0].missions[0].tokensToWin).toBe(player.tokens - initialTokens);
	});
});