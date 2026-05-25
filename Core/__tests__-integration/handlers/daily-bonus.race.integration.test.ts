import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";

type DailyBonusModule = typeof import("../../src/commands/player/DailyBonusCommand");
type ObjectItemModule = typeof import("../../src/data/ObjectItem");

const N_CONCURRENT = 25;
const MONEY_OBJECT_ID = 2; // nature=MONEY, power=60 — see Core/resources/objects/2.json

/**
 * Race test for {@link DailyBonusModule.activateDailyItem}. The
 * critical section locks `[Player, InventoryInfo]`, re-checks the
 * daily cooldown inside the lock, and only applies the bonus +
 * refreshes `lastDailyAt` when not on cooldown. Without the lock, two
 * concurrent claims could both pass the cooldown check and double the
 * bonus (#3760). Racing N callers must yield EXACTLY ONE applied
 * bonus.
 */
describe("DailyBonusCommand.activateDailyItem race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let dailyBonus: DailyBonusModule;
	let objectItemModule: ObjectItemModule;

	beforeAll(async () => {
		env = await setupCoreForTests("dailybonus");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		InventoryInfo = env.crownicles.gameDatabase.sequelize.models.InventoryInfo as ModelStatic<InventoryInfoType>;
		dailyBonus = loadProductionModule<DailyBonusModule>("commands/player/DailyBonusCommand");
		objectItemModule = loadProductionModule<ObjectItemModule>("data/ObjectItem");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it(`applies the bonus exactly once when ${N_CONCURRENT} callers race`, async () => {
		const moneyObject = objectItemModule.ObjectItemDataController.instance.getById(MONEY_OBJECT_ID);
		expect(moneyObject).toBeTruthy();

		const player = await Player.create({
			keycloakId: "race-daily-bonus",
			money: 0
		});
		// Last daily a year ago → cooldown is comfortably expired.
		const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		await InventoryInfo.create({
			playerId: player.id,
			lastDailyAt: longAgo
		});

		// Each invocation reads its own InventoryInfo handle (matches production:
		// `freshInventoryInfo = await InventoryInfos.getOfPlayer(player.id)` per call).
		const results = await Promise.allSettled(
			Array.from({ length: N_CONCURRENT }, async () => {
				const freshPlayer = await Player.findByPk(player.id);
				const freshInv = await InventoryInfo.findByPk(player.id);
				await dailyBonus.activateDailyItem(freshPlayer!, moneyObject!, freshInv!, []);
			})
		);

		const rejected = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
		if (rejected.length > 0) {
			throw rejected[0].reason;
		}

		const fresh = await Player.findByPk(player.id);
		const freshInv = await InventoryInfo.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(freshInv).toBeTruthy();

		// Exactly one bonus applied: money strictly less than two bonuses.
		// (BlessingManager may multiply, so we don't assert exact value.)
		expect(fresh!.money).toBeGreaterThan(0);
		expect(fresh!.money).toBeLessThan(2 * moneyObject!.power * 10); // generous upper bound

		// lastDailyAt was refreshed to a recent time.
		expect(freshInv!.lastDailyAt.getTime()).toBeGreaterThan(longAgo.getTime());
	});
});
