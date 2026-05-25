import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";

type MissionShopItemsModule = typeof import("../../src/core/utils/MissionShopItems");

const N_CONCURRENT = 30;

/**
 * Race test for {@link MissionShopItemsModule.getMoneyShopItem}'s
 * `buyCallback`. Production behaviour (fixed by #3760): the callback
 * wraps `addMoney(...) + save()` in `withLockedEntitiesSafe` so every
 * concurrent invocation serialises on the player row. The invariant
 * is therefore "no lost updates": running the callback N times in
 * parallel must leave the player with exactly `initial + N * amount`
 * money — never less, because that would prove a missing lock.
 *
 * Without the lock, two callers would each read e.g. money=0,
 * each compute money += amount, each save money=amount → final
 * money=amount instead of 2*amount.
 */
describe("MissionShopItems.getMoneyShopItem race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let missionShopItems: MissionShopItemsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("missionmoney");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		missionShopItems = loadProductionModule<MissionShopItemsModule>(
			"core/utils/MissionShopItems"
		);
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

	it(`credits exactly N * amount when ${N_CONCURRENT} callers race`, async () => {
		const player = await Player.create({
			keycloakId: "race-money-player",
			money: 0
		});
		await PlayerMissionsInfo.create({ playerId: player.id });

		const amount = missionShopItems.calculateGemsToMoneyRatio();
		const item = missionShopItems.getMoneyShopItem();

		const values = await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => item.buyCallback([], player.id))
		);

		const successes = values.filter(v => v === true).length;
		expect(successes).toBe(N_CONCURRENT);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT * amount);
	});
});
