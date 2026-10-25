import {
	afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import { KingChallengeConstants } from "../../../Lib/src/constants/KingChallengeConstants";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";
import { TokensConstants } from "../../../Lib/src/constants/TokensConstants";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import type { KingChallengeTierReachedPacket } from "../../../Lib/src/packets/events/KingChallengeTierReachedPacket";

type KingChallengeModule = typeof import("../../src/core/kingChallenge/KingChallenge");
type WithLockedPlayerAndMissionsModule = typeof import("../../src/core/utils/withLockedPlayerAndMissions");

const THRESHOLDS = KingChallengeConstants.computeThresholds(KingChallengeConstants.DEFAULT_REFERENCE_SCORES);

const INITIAL_MONEY = 100;

const INITIAL_GEMS = 2;

const N_CONCURRENT_GAINS = 10;

const ENCLOSING_GEMS = 5;

const FIRST_GEM_TIER = KingChallengeConstants.REWARDS.findIndex(reward => reward.gems > 0) + 1;

function tierReachedPackets(response: CrowniclesPacket[]): KingChallengeTierReachedPacket[] {
	return response.filter(packet => packet.constructor.name === "KingChallengeTierReachedPacket") as KingChallengeTierReachedPacket[];
}

/**
 * The king's challenge pays each tier once per week, when the weekly score first reaches it.
 * Invariants checked on the persisted state: the rewards of exactly the crossed tiers are granted,
 * a tier is never paid twice (score lost then regained, concurrent gains), and the tokens are only
 * credited to a player below the token cap when the action crossing the tier started.
 */
describe("king's challenge", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let kingChallenge: KingChallengeModule;
	let withLockedPlayerAndMissions: WithLockedPlayerAndMissionsModule["withLockedPlayerAndMissions"];

	beforeAll(async () => {
		env = await setupCoreForTests("kingchallenge");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		kingChallenge = loadProductionModule<KingChallengeModule>("core/kingChallenge/KingChallenge");
		withLockedPlayerAndMissions = loadProductionModule<WithLockedPlayerAndMissionsModule>("core/utils/withLockedPlayerAndMissions").withLockedPlayerAndMissions;

		// Creates the setting rows of the thresholds, like at startup
		await kingChallenge.getKingChallengeThresholds();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({
				truncate: true, force: true
			});
			await PlayerMissionsInfo.destroy({
				truncate: true, force: true
			});
			await Player.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function seed(keycloakId: string, weeklyScore: number, tokens = 0): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId,
			weeklyScore,
			score: weeklyScore,
			money: INITIAL_MONEY,
			tokens
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			gems: INITIAL_GEMS
		});
		return player;
	}

	async function gainScore(playerId: number, amount: number, response: CrowniclesPacket[] = []): Promise<void> {
		const player = (await Player.findByPk(playerId))!;
		await player.addScore({
			response,
			amount,
			reason: NumberChangeReason.TEST,
			ignoreBlessing: true
		});
	}

	/**
	 * @param playerId
	 * @param tier
	 * @param initialTokens
	 * @param grantedTokens Tokens expected on top of the initial ones, the tokens of the tiers by default
	 */
	async function expectRewarded(playerId: number, tier: number, initialTokens = 0, grantedTokens?: number): Promise<void> {
		const reward = KingChallengeConstants.sumRewards(0, tier);
		const player = (await Player.findByPk(playerId))!;
		const missionsInfo = (await PlayerMissionsInfo.findByPk(playerId))!;
		expect({
			tier: player.kingChallengeTier,
			money: player.money,
			tokens: player.tokens,
			gems: missionsInfo.gems
		}).toEqual({
			tier,
			money: INITIAL_MONEY + reward.money,
			tokens: initialTokens + (grantedTokens ?? reward.tokens),
			gems: INITIAL_GEMS + reward.gems
		});
	}

	it("pays every tier crossed at once and announces the crossing", async () => {
		const player = await seed("king-burst", THRESHOLDS[0] - 1);
		const response: CrowniclesPacket[] = [];

		await gainScore(player.id, THRESHOLDS[2] - THRESHOLDS[0] + 1, response);

		await expectRewarded(player.id, 3);
		const [packet] = tierReachedPackets(response);
		expect(packet).toMatchObject({
			tier: 3,
			crossedTiers: 3,
			reward: KingChallengeConstants.sumRewards(0, 3),
			pointsToNextTier: THRESHOLDS[3] - THRESHOLDS[2]
		});
	});

	it("pays nothing below the first tier", async () => {
		const player = await seed("king-below", 0);
		const response: CrowniclesPacket[] = [];

		await gainScore(player.id, THRESHOLDS[0] - 1, response);

		await expectRewarded(player.id, 0);
		expect(tierReachedPackets(response)).toHaveLength(0);
	});

	it("never pays a tier twice when the weekly score drops and comes back", async () => {
		const player = await seed("king-yoyo", 0);
		await gainScore(player.id, THRESHOLDS[1]);

		await gainScore(player.id, -(THRESHOLDS[1] - THRESHOLDS[0] + 1));
		const response: CrowniclesPacket[] = [];
		await gainScore(player.id, THRESHOLDS[1] - THRESHOLDS[0] + 1, response);

		await expectRewarded(player.id, 2);
		expect(tierReachedPackets(response)).toHaveLength(0);
	});

	it("lets the tokens of a tier exceed the token cap when the player is below it", async () => {
		const player = await seed("king-almost-capped", THRESHOLDS[0] - 1, TokensConstants.MAX - 1);

		await gainScore(player.id, 1);

		await expectRewarded(player.id, 1, TokensConstants.MAX - 1);
	});

	it("pays the other rewards but no tokens to a player at or above the token cap, and announces it", async () => {
		for (const [keycloakId, tokens] of [["king-capped", TokensConstants.MAX], ["king-hoarder", TokensConstants.MAX * 2]] as const) {
			const player = await seed(keycloakId, THRESHOLDS[0] - 1, tokens);
			const response: CrowniclesPacket[] = [];

			await gainScore(player.id, 1, response);

			await expectRewarded(player.id, 1, tokens, 0);
			expect(tierReachedPackets(response).map(packet => [packet.reward.tokens, packet.ownedTokens])).toEqual([[0, tokens]]);
		}
	});

	it("pays both the expedition tokens and the tier its score crosses when the expedition brings the player to the cap", async () => {
		const initialTokens = TokensConstants.MAX - 1;
		const expeditionTokens = 3;

		// Both orders: the tier tokens reaching the cap before the expedition tokens, and the reverse
		for (const [keycloakId, tokensFirst] of [["king-expedition-score-first", false], ["king-expedition-tokens-first", true]] as const) {
			const player = await seed(keycloakId, THRESHOLDS[0] - 1, initialTokens);
			const response: CrowniclesPacket[] = [];

			await withLockedPlayerAndMissions(player.id, lockedPlayer => lockedPlayer.runWithTokenCapReference(async () => {
				const grantExpeditionTokens = (): Promise<number> => lockedPlayer.addTokensAndGetActualGain({
					response,
					amount: expeditionTokens,
					reason: NumberChangeReason.EXPEDITION
				});
				if (tokensFirst) {
					expect(await grantExpeditionTokens()).toBe(expeditionTokens);
				}
				await lockedPlayer.addScore({
					response,
					amount: 1,
					reason: NumberChangeReason.EXPEDITION,
					ignoreBlessing: true
				});
				if (!tokensFirst) {
					expect(await grantExpeditionTokens()).toBe(expeditionTokens);
				}
			}));

			await expectRewarded(player.id, 1, initialTokens, KingChallengeConstants.REWARDS[0].tokens + expeditionTokens);
		}
	});

	it("pays no tier tokens once an earlier action brought the player to the cap", async () => {
		const player = await seed("king-capped-before", THRESHOLDS[0] - 1, TokensConstants.MAX - 1);
		await withLockedPlayerAndMissions(player.id, lockedPlayer => lockedPlayer.addTokens({
			response: [],
			amount: 3,
			reason: NumberChangeReason.EXPEDITION
		}));

		await gainScore(player.id, 1);

		await expectRewarded(player.id, 1, TokensConstants.MAX + 2, 0);
	});

	it(`pays a tier exactly once when ${N_CONCURRENT_GAINS} score gains race to cross it`, async () => {
		const player = await seed("king-race", THRESHOLDS[0] - 1);

		const responses = Array.from({ length: N_CONCURRENT_GAINS }, (): CrowniclesPacket[] => []);
		await runAllOrThrow(responses.map(response => gainScore(player.id, 1, response)));

		await expectRewarded(player.id, 1);
		expect(responses.flatMap(tierReachedPackets)).toHaveLength(1);
	});

	it("keeps the gems of a tier paid while an enclosing mission completion credits its own gems", async () => {
		const player = await seed("king-enclosing-gems", THRESHOLDS[FIRST_GEM_TIER - 1] - 1);

		// Like a daily mission completed after its streak mission crossed a tier: the enclosing instance predates the tier gems
		await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
			const enclosingMissionsInfo = (await PlayerMissionsInfo.findByPk(player.id))!;
			await lockedPlayer.addScore({
				response: [],
				amount: 1,
				reason: NumberChangeReason.TEST,
				ignoreBlessing: true
			});
			await enclosingMissionsInfo.addGems(ENCLOSING_GEMS, lockedPlayer.keycloakId, NumberChangeReason.TEST);
		});

		const missionsInfo = (await PlayerMissionsInfo.findByPk(player.id))!;
		expect(missionsInfo.gems).toBe(INITIAL_GEMS + KingChallengeConstants.sumRewards(0, FIRST_GEM_TIER).gems + ENCLOSING_GEMS);
	});

	it("announces nothing and grants nothing when crediting the rewards fails", async () => {
		const player = await seed("king-failed-credit", THRESHOLDS[FIRST_GEM_TIER - 1] - 1);

		// Its expiry is announced by the mission update of the gain, which is rolled back with the rewards
		await MissionSlot.create({
			playerId: player.id,
			missionId: "earnPoints",
			missionVariant: 0,
			missionObjective: 1_000,
			numberDone: 0,
			expiresAt: new Date(Date.now() - 3_600_000),
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0
		});
		vi.spyOn(PlayerMissionsInfo.prototype as PlayerMissionsInfoType, "addGems").mockRejectedValueOnce(new Error("gem credit failed"));
		const response: CrowniclesPacket[] = [];

		await expect(gainScore(player.id, 1, response)).rejects.toThrow("gem credit failed");

		expect(response).toEqual([]);
		expect(await MissionSlot.count({ where: { playerId: player.id } })).toBe(1);
		await expectRewarded(player.id, 0);
		expect((await Player.findByPk(player.id))!.weeklyScore).toBe(THRESHOLDS[FIRST_GEM_TIER - 1] - 1);
	});

	it("pays a tier crossed by the missions completed with the rewards of the previous one", async () => {
		const player = await seed("king-chained-tiers", THRESHOLDS[0] - 1);

		// Completed by the money of the first tier, its points cross the second one
		await MissionSlot.create({
			playerId: player.id,
			missionId: "earnMoney",
			missionVariant: 0,
			missionObjective: 1,
			numberDone: 0,
			expiresAt: new Date(Date.now() + 3_600_000),
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: THRESHOLDS[1] - THRESHOLDS[0],
			moneyToWin: 0
		});
		const response: CrowniclesPacket[] = [];

		await gainScore(player.id, 1, response);

		await expectRewarded(player.id, 2);
		const firstTierTokens = KingChallengeConstants.REWARDS[0].tokens;
		expect(tierReachedPackets(response).map(packet => [packet.tier, packet.ownedTokens])).toEqual([
			[1, firstTierTokens],
			[2, firstTierTokens + KingChallengeConstants.REWARDS[1].tokens]
		]);
	});

	it("shows the progress of the week with the coming Monday reset", async () => {
		const player = await seed("king-progress", 0);
		await gainScore(player.id, THRESHOLDS[1]);

		const progress = await kingChallenge.getKingChallengeProgress((await Player.findByPk(player.id))!);

		expect(progress).toMatchObject({
			weeklyScore: THRESHOLDS[1],
			tier: 2,
			thresholds: THRESHOLDS
		});
		expect(progress.nextResetDate).toBeGreaterThan(Date.now());
		expect(progress.nextResetDate).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
		expect(new Date(progress.nextResetDate + 1).getDay()).toBe(1);
	});

	it("records the reference scores of the week that set the next thresholds", async () => {
		await seed("king-summary-completed", 0);
		await gainScore((await Player.findOne({ where: { keycloakId: "king-summary-completed" } }))!.id, THRESHOLDS[THRESHOLDS.length - 1]);
		const weeklyScores = [THRESHOLDS[0], 50_000, 40_000, 30_000, 20_000];
		for (const [index, weeklyScore] of weeklyScores.entries()) {
			await seed(`king-summary-${index}`, weeklyScore);
		}

		// Best weekly scores: the champion threshold, 50 000, 40 000, 30 000, then 20 000 as the fifth one
		const weekScores = await kingChallenge.getWeeklyReferenceScores();
		expect(weekScores).toEqual({
			ladder: 20_000,
			champion: THRESHOLDS[THRESHOLDS.length - 1]
		});

		await kingChallenge.startNewKingChallengeWeek(weekScores);
		const expectedReferences = KingChallengeConstants.pushReferenceScores(KingChallengeConstants.DEFAULT_REFERENCE_SCORES, weekScores!);
		expect(await kingChallenge.getKingChallengeThresholds()).toEqual(KingChallengeConstants.computeThresholds(expectedReferences));
	});
});
