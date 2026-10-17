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
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type PlayerLevelUpPacketModule = typeof import("../../../Lib/src/packets/events/PlayerLevelUpPacket");

const EXPERIENCE_DELTA = 10;

describe("Player experience race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let DailyMission: ModelStatic<DailyMissionType>;
	let playerMod: PlayerModelModule;
	let playerLevelUpPacketModule: PlayerLevelUpPacketModule;

	beforeAll(async () => {
		env = await setupCoreForTests("playerexperiencerace");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		DailyMission = env.crownicles.gameDatabase.sequelize.models.DailyMission as ModelStatic<DailyMissionType>;
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
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("preserves concurrent XP gains and emits the reached level once", async () => {
		const player = await Player.create({
			keycloakId: "race-player-experience",
			level: 10
		});
		player.experience = player.getExperienceNeededToLevelUp() - EXPERIENCE_DELTA;
		await player.save();
		await PlayerMissionsInfo.create({ playerId: player.id });
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

		const responses: CrowniclesPacket[][] = [[], []];
		const players = await runAllOrThrow([
			playerMod.Player.findByPk(player.id),
			playerMod.Player.findByPk(player.id)
		]);
		expect(players.every(Boolean)).toBe(true);

		await runAllOrThrow(players.map((concurrentPlayer, index) => concurrentPlayer!.addExperience({
			amount: EXPERIENCE_DELTA,
			response: responses[index],
			reason: NumberChangeReason.TEST
		})));

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.level).toBe(11);
		expect(fresh!.experience).toBe(EXPERIENCE_DELTA);
		const emittedLevels = responses.flat()
			.filter(packet => packet instanceof playerLevelUpPacketModule.PlayerLevelUpPacket)
			.map(packet => (packet as InstanceType<typeof playerLevelUpPacketModule.PlayerLevelUpPacket>).level);
		expect(emittedLevels).toEqual([11]);
	});
});
