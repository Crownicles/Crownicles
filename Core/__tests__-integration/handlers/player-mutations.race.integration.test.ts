import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { DailyMission as DailyMissionType } from "../../src/core/database/game/models/DailyMission";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type PlayerLevelUpPacketModule = typeof import("../../../Lib/src/packets/events/PlayerLevelUpPacket");

describe("Player mutations race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let DailyMission: ModelStatic<DailyMissionType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let playerMod: PlayerModelModule;
	let playerLevelUpPacketModule: PlayerLevelUpPacketModule;

	beforeAll(async () => {
		env = await setupCoreForTests("playermutationsrace");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		DailyMission = env.crownicles.gameDatabase.sequelize.models.DailyMission as ModelStatic<DailyMissionType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		playerMod = loadProductionModule<PlayerModelModule>("core/database/game/models/Player");
		playerLevelUpPacketModule = loadProductionModule<PlayerLevelUpPacketModule>("../../Lib/src/packets/events/PlayerLevelUpPacket");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await DailyMission.destroy({ truncate: true, force: true });
			await MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await DailyMission.create({
			id: 0,
			missionId: "doReports",
			missionObjective: 100,
			missionVariant: 0,
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});
	});

	async function loadConcurrentPlayers(playerId: number): Promise<[PlayerType, PlayerType]> {
		const players = await runAllOrThrow([
			playerMod.Player.findByPk(playerId),
			playerMod.Player.findByPk(playerId)
		]);
		expect(players.every(Boolean)).toBe(true);
		return players as [PlayerType, PlayerType];
	}

	it("preserves concurrent money gain and token spending", async () => {
		const player = await Player.create({
			keycloakId: "race-player-money-tokens",
			money: 1000,
			tokens: 10
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		const [moneyPlayer, tokenPlayer] = await loadConcurrentPlayers(player.id);

		await runAllOrThrow([
			moneyPlayer.addMoney({
				amount: 100,
				response: [],
				reason: NumberChangeReason.TEST,
				ignoreBlessing: true
			}),
			tokenPlayer.useTokens({
				amount: 3,
				response: [],
				reason: NumberChangeReason.TEST
			})
		]);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(1100);
		expect(fresh!.tokens).toBe(7);
	});

	it("preserves concurrent healing and XP while emitting one level", async () => {
		const player = await Player.create({
			keycloakId: "race-player-health-experience",
			level: 10,
			health: 50
		});
		player.experience = player.getExperienceNeededToLevelUp() - 10;
		await player.save();
		await PlayerMissionsInfo.create({ playerId: player.id });
		const [healthPlayer, experiencePlayer] = await loadConcurrentPlayers(player.id);
		const responses: CrowniclesPacket[][] = [[], []];

		await runAllOrThrow([
			healthPlayer.addHealth({
				amount: 20,
				response: responses[0],
				reason: NumberChangeReason.TEST
			}),
			experiencePlayer.addExperience({
				amount: 10,
				response: responses[1],
				reason: NumberChangeReason.TEST
			})
		]);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.health).toBe(70);
		expect(fresh!.level).toBe(11);
		expect(fresh!.experience).toBe(0);
		const emittedLevels = responses.flat()
			.filter(packet => packet instanceof playerLevelUpPacketModule.PlayerLevelUpPacket)
			.map(packet => (packet as InstanceType<typeof playerLevelUpPacketModule.PlayerLevelUpPacket>).level);
		expect(emittedLevels).toEqual([11]);
	});

	it("synchronizes rewards when player mutation completes daily and normal missions", async () => {
		await DailyMission.destroy({ truncate: true, force: true });
		await DailyMission.create({
			id: 0,
			missionId: "earnMoney",
			missionObjective: 1,
			missionVariant: 0,
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});
		const player = await Player.create({
			keycloakId: "mission-completion-sync",
			money: 100,
			experience: 0
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "earnMoney",
			missionVariant: 0,
			missionObjective: 1,
			numberDone: 0,
			expiresAt: new Date(Date.now() + 3_600_000),
			gemsToWin: 0,
			xpToWin: 25,
			pointsToWin: 0,
			moneyToWin: 0
		});

		const returnedPlayer = await player.addMoney({
			amount: 1,
			response: [],
			reason: NumberChangeReason.TEST,
			ignoreBlessing: true
		});

		expect(returnedPlayer).toBe(player);
		expect(player.money).toBe(101);
		expect(player.experience).toBe(25);
		expect(player.changed()).toBe(false);
		const freshPlayer = await Player.findByPk(player.id);
		expect(freshPlayer).toMatchObject({
			money: 101,
			experience: 25
		});
	});
});