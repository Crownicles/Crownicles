import {
	afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import { Effect } from "../../../Lib/src/types/Effect";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";

type PlayerModule = typeof import("../../src/core/database/game/models/Player");
type FightCommandModule = typeof import("../../src/commands/player/FightCommand");
type LogsFightHistoryRequestsModule = typeof import("../../src/core/database/logs/requests/LogsFightHistoryRequests");
type CrowniclesSundayModule = typeof import("../../src/core/bot/cronJobs/CrowniclesSunday");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");

const FIGHT_LOG_ID = 1;

/**
 * Ranked fight ratings (#5140): the matchmaking no longer offers dead players as active opponents, the end of the
 * season no longer moves attack glory into defense glory, and the defense rating of a rarely attacked player
 * converges as fast as the attack rating of a rarely attacking one.
 */
describe("ranked fight ratings", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Players: PlayerModule["Players"];
	let updatePlayersEloAndCooldowns: FightCommandModule["updatePlayersEloAndCooldowns"];
	let LogsFightHistoryRequests: LogsFightHistoryRequestsModule["LogsFightHistoryRequests"];
	let CrowniclesSunday: CrowniclesSundayModule["CrowniclesSunday"];
	let PacketUtils: PacketUtilsModule["PacketUtils"];

	beforeAll(async () => {
		env = await setupCoreForTests("rankedfightratings");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Players = loadProductionModule<PlayerModule>("core/database/game/models/Player").Players;
		updatePlayersEloAndCooldowns = loadProductionModule<FightCommandModule>("commands/player/FightCommand").updatePlayersEloAndCooldowns;
		LogsFightHistoryRequests = loadProductionModule<LogsFightHistoryRequestsModule>("core/database/logs/requests/LogsFightHistoryRequests")
			.LogsFightHistoryRequests;
		CrowniclesSunday = loadProductionModule<CrowniclesSundayModule>("core/bot/cronJobs/CrowniclesSunday").CrowniclesSunday;
		PacketUtils = loadProductionModule<PacketUtilsModule>("core/utils/PacketUtils").PacketUtils;
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await Player.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	describe("opponent search", () => {
		it("never offers a dead player as an active opponent, but keeps them among the other opponents", async () => {
			const attacker = await Player.create({
				keycloakId: "opponents-attacker", level: 20, attackGloryPoints: 100, defenseGloryPoints: 100
			});
			const alive = await Player.create({
				keycloakId: "opponents-alive", level: 20, defenseGloryPoints: 100, startTravelDate: new Date()
			});
			const dead = await Player.create({
				keycloakId: "opponents-dead",
				level: 20,
				defenseGloryPoints: 100,
				effectId: Effect.DEAD.id,

				// The travel dates of the players who died in 2021-2022, which made them look active until 2053
				startTravelDate: new Date("2053-06-01T00:00:00.000Z")
			});

			const activeOpponents = await Players.findActivePotentialOpponents(attacker, FightConstants.ACTIVE_PLAYER_PER_OPPONENT_SEARCH, 0);
			const opponents = await Players.findPotentialOpponents(attacker, FightConstants.PLAYER_PER_OPPONENT_SEARCH, 0);

			expect(activeOpponents.map(opponent => opponent.id)).toEqual([alive.id]);
			expect(opponents.map(opponent => opponent.id).sort()).toEqual([alive.id, dead.id].sort());
		});
	});

	describe("end of the season", () => {
		it("no longer moves attack glory into defense glory, but still closes the season", async () => {
			const fighter = await Player.create({
				keycloakId: "season-fighter", attackGloryPoints: 600, defenseGloryPoints: 900, fightCountdown: 0
			});
			const idle = await Player.create({
				keycloakId: "season-idle", attackGloryPoints: 300, defenseGloryPoints: 200, fightCountdown: 3
			});
			vi.spyOn(PacketUtils, "isMqttConnected").mockReturnValue(true);
			vi.spyOn(PacketUtils, "announce").mockImplementation(() => undefined);

			await CrowniclesSunday.job();

			await fighter.reload();
			await idle.reload();
			expect([fighter.attackGloryPoints, fighter.defenseGloryPoints, fighter.gloryPointsLastSeason, fighter.fightCountdown])
				.toEqual([600, 900, 1_500, 1]);
			expect([idle.attackGloryPoints, idle.defenseGloryPoints, idle.gloryPointsLastSeason, idle.fightCountdown])
				.toEqual([300, 200, 0, 4]);
		});
	});

	describe("defender K-factor", () => {
		const INITIAL_GLORY = 150;

		/**
		 * Resolve a fight won by the defender, both sides at the same rating
		 * @param rawDefenseCount - ranked defenses of the defender in the window, the current fight included like in the logs
		 */
		async function defenderWins(rawDefenseCount: number): Promise<PlayerType> {
			const attacker = await Player.create({
				keycloakId: "k-factor-attacker", level: 29, attackGloryPoints: INITIAL_GLORY, defenseGloryPoints: INITIAL_GLORY
			});
			const defender = await Player.create({
				keycloakId: "k-factor-defender", level: 44, attackGloryPoints: 0, defenseGloryPoints: INITIAL_GLORY, fightCountdown: 2
			});
			vi.spyOn(LogsFightHistoryRequests, "getAttackCountInLastNWeeks")
				.mockResolvedValue(FightConstants.ELO.INACTIVE_ATTACKER.FIGHT_COUNT_THRESHOLD + 1);
			vi.spyOn(LogsFightHistoryRequests, "getDefenseCountInLastNWeeks").mockResolvedValue(rawDefenseCount);

			await updatePlayersEloAndCooldowns(attacker, defender, EloGameResult.LOSS, EloGameResult.WIN, [], FIGHT_LOG_ID);

			return await defender.reload();
		}

		it("makes the defense rating of a player not attacked in the window converge as fast as a returning attacker", async () => {
			// Only the current fight is logged: K = 32 x 4 = 128, so +64 then +71 from the low rating adjustment
			const defender = await defenderWins(1);

			expect(defender.defenseGloryPoints).toBe(285);
			expect(defender.fightCountdown).toBe(1);
		});

		it("keeps the regular K-factor for a player attacked regularly", async () => {
			// K = 32, so +16 then +18 from the low rating adjustment
			const defender = await defenderWins(FightConstants.ELO.INACTIVE_DEFENDER.FIGHT_COUNT_THRESHOLD + 1);

			expect(defender.defenseGloryPoints).toBe(184);
		});
	});
});
