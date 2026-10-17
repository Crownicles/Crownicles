import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { PlayerActiveObjects } from "../../src/core/database/game/models/PlayerActiveObjects";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type ReportPveServiceModule = typeof import("../../src/core/report/ReportPveService");

const LEVEL_AFTER_FIGHT = 20;

// Only the enchantments are read to compute the max energy: no enchantment, no bonus.
const NO_ENCHANTMENT_OBJECTS = {
	weapon: { itemEnchantmentId: null },
	armor: { itemEnchantmentId: null }
} as unknown as PlayerActiveObjects;

describe("PvE boss post-fight persistence (#4829)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let playerMod: PlayerModelModule;
	let pveService: ReportPveServiceModule;

	beforeAll(async () => {
		env = await setupCoreForTests("pvebosspostfight");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		playerMod = loadProductionModule<PlayerModelModule>("core/database/game/models/Player");
		pveService = loadProductionModule<ReportPveServiceModule>("core/report/ReportPveService");
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
		await pinInertDailyMission(env);
	});

	it("leaves the caller clean after a loss whose fight missions levelled the player up", async () => {
		const created = await Player.create({
			keycloakId: "pve-boss-loss-level-up",
			class: 1,
			level: LEVEL_AFTER_FIGHT,
			money: 100
		});
		await PlayerMissionsInfo.create({ playerId: created.id });
		const player = (await playerMod.Player.findByPk(created.id))!;

		// The fight drained the energy of the former level; mission rewards then raised the level, hence the max energy.
		const energyLostDuringFight = player.getMaxCumulativeEnergy(NO_ENCHANTMENT_OBJECTS, LEVEL_AFTER_FIGHT - 1);
		const maxEnergy = player.getMaxCumulativeEnergy(NO_ENCHANTMENT_OBJECTS);
		expect(maxEnergy).toBeGreaterThan(energyLostDuringFight);
		player.fightPointsLost = energyLostDuringFight;
		await player.save();

		await pveService.persistPveBossPostFightUnderLock(player, energyLostDuringFight, false, NO_ENCHANTMENT_OBJECTS);

		expect(player.changed()).toBe(false);
		expect(player.fightPointsLost).toBe(maxEnergy);

		// Same locked money loss as `leavePVEIslandIfNoEnergy` once the player has no energy left.
		await player.addMoney({
			amount: -10,
			response: [],
			reason: NumberChangeReason.PVE_ISLAND,
			ignoreBlessing: true
		});
		expect(await Player.findByPk(created.id)).toMatchObject({
			fightPointsLost: maxEnergy,
			money: 90
		});
	});
});
