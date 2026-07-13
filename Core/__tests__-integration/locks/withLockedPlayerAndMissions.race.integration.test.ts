import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type PlayerLockModule = typeof import("../../src/core/utils/withLockedPlayerAndMissions");

const N_CONCURRENT = 20;
const MONEY_DELTA = 10;

describe("withLockedPlayerAndMissions race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let playerMod: PlayerModelModule;
	let playerLockMod: PlayerLockModule;

	beforeAll(async () => {
		env = await setupCoreForTests("player_missions_lock");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		playerMod = loadProductionModule<PlayerModelModule>("core/database/game/models/Player");
		playerLockMod = loadProductionModule<PlayerLockModule>("core/utils/withLockedPlayerAndMissions");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("prewarms a missing PlayerMissionsInfo row before locking", async () => {
		const player = await Player.create({
			keycloakId: "race-player-missions-prewarm",
			money: 0
		});

		await playerLockMod.withLockedPlayerAndMissions(player.id, async lockedPlayer => {
			expect(lockedPlayer.id).toBe(player.id);
		});

		const missionsInfo = await PlayerMissionsInfo.findByPk(player.id);
		expect(missionsInfo).toBeTruthy();
	});

	it(`serialises ${N_CONCURRENT} mixed nested and standalone mission updates without deadlock`, async () => {
		const player = await Player.create({
			keycloakId: "race-player-missions-money",
			money: 0
		});

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, (_, index) => index % 2 === 0
				? playerLockMod.withLockedPlayerAndMissions(player.id, async lockedPlayer => {
					await lockedPlayer.addMoney({
						amount: MONEY_DELTA,
						response: [],
						reason: NumberChangeReason.TEST,
						ignoreBlessing: true
					});
				})
				: (async (): Promise<void> => {
					const standalonePlayer = await playerMod.Player.findByPk(player.id);
					expect(standalonePlayer).toBeTruthy();
					await standalonePlayer!.addMoney({
						amount: MONEY_DELTA,
						response: [],
						reason: NumberChangeReason.TEST,
						ignoreBlessing: true
					});
				})())
		);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT * MONEY_DELTA);
	});
});
