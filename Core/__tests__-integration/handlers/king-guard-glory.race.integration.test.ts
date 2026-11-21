import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { KingGuardState as KingGuardStateType } from "../../src/core/database/game/models/KingGuardState";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";

type KingGuardFightCommandModule = typeof import("../../src/commands/player/KingGuardFightCommand");

const CONCURRENT_FIGHTS = 8;
const INITIAL_GLORY = 1_500;
const INITIAL_FIGHT_COUNTDOWN = 5;

describe("king guard ratings under concurrent fights", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let KingGuardState: ModelStatic<KingGuardStateType>;
	let applyKingGuardFightResult: KingGuardFightCommandModule["applyKingGuardFightResult"];

	beforeAll(async () => {
		env = await setupCoreForTests("kingguardrace");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		KingGuardState = env.crownicles.gameDatabase.sequelize.models.KingGuardState as ModelStatic<KingGuardStateType>;
		applyKingGuardFightResult = loadProductionModule<KingGuardFightCommandModule>("commands/player/KingGuardFightCommand").applyKingGuardFightResult;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("never loses a rating change of a guard fought by several players at the same time", async () => {
		const guard = await KingGuardState.create({
			id: 1, glory: INITIAL_GLORY
		});
		const players = await Promise.all(Array.from({ length: CONCURRENT_FIGHTS }, (_, index) => Player.create({
			keycloakId: `king-guard-race-${index}`,
			level: 150,
			guardGloryPoints: INITIAL_GLORY
		})));

		const changes = await runAllOrThrow(players.map(player => applyKingGuardFightResult({
			playerId: player.id, guardId: guard.id
		}, {
			playerResult: EloGameResult.WIN, playerKFactor: FightConstants.KING_GUARD.RATING.PLAYER_K_FACTOR
		})));

		await guard.reload();
		expect(guard.losses).toBe(CONCURRENT_FIGHTS);

		// Each change was computed from the rating left by the previous one: the guard keeps all of them
		expect(guard.glory).toBe(INITIAL_GLORY + changes.reduce((total, change) => total + change!.guardGloryChange, 0));
		expect(new Set(changes.map(change => change!.guardGlory)).size).toBe(CONCURRENT_FIGHTS);
	});

	it("keeps every rating change and fight countdown decrement of a player fighting two guards at the same time", async () => {
		await KingGuardState.bulkCreate([
			{
				id: 2, glory: INITIAL_GLORY
			},
			{
				id: 3, glory: INITIAL_GLORY
			}
		]);
		const player = await Player.create({
			keycloakId: "king-guard-race-double",
			level: 150,
			guardGloryPoints: INITIAL_GLORY,
			fightCountdown: INITIAL_FIGHT_COUNTDOWN
		});

		const changes = await runAllOrThrow([2, 3].map(guardId => applyKingGuardFightResult({
			playerId: player.id, guardId
		}, {
			playerResult: EloGameResult.LOSS, playerKFactor: FightConstants.KING_GUARD.RATING.PLAYER_K_FACTOR
		})));

		await player.reload();
		expect(player.fightCountdown).toBe(INITIAL_FIGHT_COUNTDOWN - 2);
		expect(player.guardGloryPoints).toBe(INITIAL_GLORY + changes.reduce((total, change) => total + change!.playerGuardGloryChange, 0));
	});
});
