import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";

type DailyBonusModule = typeof import("../../src/commands/player/DailyBonusCommand");
type ObjectItemModule = typeof import("../../src/data/ObjectItem");

const N_CONCURRENT = 25;

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
		const moneyObject = objectItemModule.ObjectItemDataController.instance
			.getAllValues()
			.find(item => item.nature === ItemNature.MONEY);
		expect(moneyObject).toBeTruthy();

		const player = await Player.create({
			keycloakId: "race-daily-bonus",
			money: 0
		});
		// Last daily a year ago -> cooldown is comfortably expired.
		const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		await InventoryInfo.create({
			playerId: player.id,
			lastDailyAt: longAgo
		});

		// Each invocation reads its own InventoryInfo handle (matches production:
		// `freshInventoryInfo = await InventoryInfos.getOfPlayer(player.id)` per call).
		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, async () => {
				const freshPlayer = await Player.findByPk(player.id);
				const freshInv = await InventoryInfo.findByPk(player.id);
				await dailyBonus.activateDailyItem(freshPlayer!, moneyObject!, freshInv!, []);
			})
		);

		const fresh = await Player.findByPk(player.id);
		const freshInv = await InventoryInfo.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(freshInv).toBeTruthy();

		// Exactly one bonus applied: persisted money is exactly `power`.
		// (Blessings only affect the packet `value` displayed to the user,
		// not the amount stored on the Player — see DailyBonusCommand.)
		expect(fresh!.money).toBe(moneyObject!.power);

		// lastDailyAt was refreshed to a recent time.
		expect(freshInv!.lastDailyAt.getTime()).toBeGreaterThan(longAgo.getTime());
	});
});
