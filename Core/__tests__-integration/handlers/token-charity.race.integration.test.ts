import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";

type ReportTokenMerchantServiceModule = typeof import("../../src/core/report/ReportTokenMerchantService");

const N_CONCURRENT = 25;

/**
 * Race test for {@link ReportTokenMerchantServiceModule.giveCharity}.
 * The token merchant gifts tokens to a broke, token-less player at most
 * once per week. The check-then-grant sequence locks both `Player` and
 * `PlayerMissionsInfo` together, so racing N callers must result in
 * EXACTLY ONE grant: the player ends up with a single charity amount of
 * tokens and the once-per-week flag flipped, never N grants.
 */
describe("ReportTokenMerchantService.giveCharity race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let service: ReportTokenMerchantServiceModule;

	beforeAll(async () => {
		env = await setupCoreForTests("tokencharity");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		service = loadProductionModule<ReportTokenMerchantServiceModule>(
			"core/report/ReportTokenMerchantService"
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

	it(`grants the weekly charity exactly once under N=${N_CONCURRENT} concurrent calls`, async () => {
		const player = await Player.create({
			keycloakId: "race-token-charity",
			money: 0,
			tokens: 0
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			hasReceivedTokenCharityThisWeek: false
		});

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => service.giveCharity(player, []))
		);

		const fresh = await Player.findByPk(player.id);
		const freshMissionsInfo = await PlayerMissionsInfo.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(freshMissionsInfo).toBeTruthy();

		// Exactly one grant: a single charity amount, never N of them.
		expect(fresh!.tokens).toBe(TokensConstants.MERCHANT_CHARITY_AMOUNT);
		expect(freshMissionsInfo!.hasReceivedTokenCharityThisWeek).toBe(true);
	});
});
