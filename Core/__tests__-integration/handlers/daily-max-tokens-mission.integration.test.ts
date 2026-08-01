import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";

type CrowniclesDailyModule = typeof import("../../src/core/bot/cronJobs/CrowniclesDaily");

describe("daily max tokens mission catch-up", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let CrowniclesDaily: CrowniclesDailyModule["CrowniclesDaily"];

	beforeAll(async () => {
		env = await setupCoreForTests("dailymaxtokens");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		MissionSlot = models.MissionSlot as ModelStatic<MissionSlotType>;
		CrowniclesDaily = loadProductionModule<CrowniclesDailyModule>("core/bot/cronJobs/CrowniclesDaily").CrowniclesDaily;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({
				truncate: true, force: true
			});
			await Player.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	async function seed(keycloakId: string, tokens: number, expiresAt: Date | null): Promise<MissionSlotType> {
		const player = await Player.create({
			keycloakId, tokens
		});
		return MissionSlot.create({
			playerId: player.id,
			missionId: "maxTokensReached",
			missionVariant: 0,
			missionObjective: 1,
			numberDone: 0,
			expiresAt,
			gemsToWin: 0,
			xpToWin: 100,
			pointsToWin: 100,
			moneyToWin: 100
		});
	}

	const tomorrow = (): Date => new Date(Date.now() + 24 * 60 * 60 * 1000);

	it("completes the mission of a player sitting at the token cap", async () => {
		const slot = await seed("maxtokens-capped", TokensConstants.MAX, tomorrow());

		await CrowniclesDaily.maxTokensReachedMissions();

		await slot.reload();
		expect(slot.numberDone).toBe(1);
	});

	it("leaves the mission untouched below the token cap", async () => {
		const slot = await seed("maxtokens-below", TokensConstants.MAX - 1, tomorrow());

		await CrowniclesDaily.maxTokensReachedMissions();

		await slot.reload();
		expect(slot.numberDone).toBe(0);
	});

	it("completes the campaign slot, which never expires", async () => {
		const slot = await seed("maxtokens-campaign", TokensConstants.MAX, null);

		await CrowniclesDaily.maxTokensReachedMissions();

		await slot.reload();
		expect(slot.numberDone).toBe(1);
	});

	it("does not revive an expired mission", async () => {
		const slot = await seed("maxtokens-expired", TokensConstants.MAX, new Date(Date.now() - 60 * 1000));

		await CrowniclesDaily.maxTokensReachedMissions();

		await slot.reload();
		expect(slot.numberDone).toBe(0);
	});
});
