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

const MISSION_OBJECTIVE = 100;
const ONE_MINUTE = 60_000;
const ONE_HOUR = 3_600_000;

/**
 * Functional regression test for issue #4621.
 *
 * `commandRequires` calls `player.markActive()` on every command entered from a
 * city, then hands that very instance to the command, which starts by poking a
 * mission (`commandReport`, `commandMission`, …). `markActive` writes its field
 * through a bulk `Player.update`, so mirroring the value back onto the instance
 * must not flag it as changed: `MissionsController.update` refuses a player
 * carrying unsaved local mutations and used to throw `UnsavedPlayerChangesError`,
 * making `/rapport` and `/mission` unusable for anyone standing in a city.
 *
 * The linter cannot catch this one: the mutation lives in the command decorator
 * while the mission update lives in the command body, two functions apart.
 */
describe("City command mission update (issue #4621)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionsController: MissionsControllerModule["MissionsController"];

	beforeAll(async () => {
		env = await setupCoreForTests("citycommandmission");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionsController = loadProductionModule<MissionsControllerModule>("core/missions/MissionsController").MissionsController;
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

	it("progresses the mission of a command entered from a city", async () => {
		const previousActivity = new Date(Date.now() - ONE_MINUTE);
		const player = await Player.create({
			keycloakId: "city-command-player",
			insideCity: true,
			lastActivityAt: previousActivity
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "commandReport",
			missionVariant: 0,
			missionObjective: MISSION_OBJECTIVE,
			numberDone: 0,
			expiresAt: new Date(Date.now() + ONE_HOUR),
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});

		// Same sequence as the commandRequires decorator followed by ReportCommand.execute.
		await player.markActive();
		const response: CrowniclesPacket[] = [];
		await MissionsController.update(player, response, { missionId: "commandReport" });

		const slot = await MissionSlot.findOne({ where: { playerId: player.id, missionId: "commandReport" } });
		expect(slot?.numberDone).toBe(1);

		// The activity tracking of #4439 must still reach the database.
		const freshPlayer = await Player.findByPk(player.id);
		expect(freshPlayer!.lastActivityAt.valueOf()).toBeGreaterThan(previousActivity.valueOf());
	});
});
