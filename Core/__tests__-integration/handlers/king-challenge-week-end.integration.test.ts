import {
	afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	DatabaseError, type ModelStatic
} from "sequelize";
import { setTimeout as sleep } from "node:timers/promises";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { KingChallengeConstants } from "../../../Lib/src/constants/KingChallengeConstants";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";
import type { TopWeekAnnouncementPacket } from "../../../Lib/src/packets/announcements/TopWeekAnnouncementPacket";

type CrowniclesMondayModule = typeof import("../../src/core/bot/cronJobs/CrowniclesMonday");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");
type KingChallengeModule = typeof import("../../src/core/kingChallenge/KingChallenge");
type SettingModule = typeof import("../../src/core/database/game/models/Setting");

const THRESHOLDS = KingChallengeConstants.computeThresholds(KingChallengeConstants.DEFAULT_REFERENCE_SCORES);

// A week far above the previous ones, which raises the thresholds of the new week
const STRONG_WEEK_SCORES = {
	ladder: 1_000_000,
	champion: 2_000_000
};

const INITIAL_MONEY = 100;

// Long enough for the blocked side of the race to reach its row lock
const LOCK_WAIT_MS = 300;

function deadlockError(): DatabaseError {
	return new DatabaseError(Object.assign(new Error("Deadlock found when trying to get lock"), {
		code: "ER_LOCK_DEADLOCK",
		sql: "",
		parameters: {}
	}));
}

type Gate = {
	reached: Promise<void>;
	release: () => void;
	pass: () => Promise<void>;
};

/**
 * Pauses the side of a race that calls `pass()` until `release()`, and tells through `reached` that it is paused
 */
function createGate(): Gate {
	let markReached!: () => void;
	let release!: () => void;
	const reached = new Promise<void>(resolve => {
		markReached = resolve;
	});
	const released = new Promise<void>(resolve => {
		release = resolve;
	});
	return {
		reached,
		release,
		pass: (): Promise<void> => {
			markReached();
			return released;
		}
	};
}

/**
 * End of the week: the reference scores of the week ending are read before the reset, the weekly scores
 * and the rewarded tiers are reset together, then those reference scores set the thresholds of the new week.
 */
describe("king's challenge week end", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let CrowniclesMonday: CrowniclesMondayModule["CrowniclesMonday"];
	let PacketUtils: PacketUtilsModule["PacketUtils"];
	let kingChallenge: KingChallengeModule;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let Settings: SettingModule["Settings"];

	beforeAll(async () => {
		env = await setupCoreForTests("kingchallengeweekend");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		CrowniclesMonday = loadProductionModule<CrowniclesMondayModule>("core/bot/cronJobs/CrowniclesMonday").CrowniclesMonday;
		PacketUtils = loadProductionModule<PacketUtilsModule>("core/utils/PacketUtils").PacketUtils;
		kingChallenge = loadProductionModule<KingChallengeModule>("core/kingChallenge/KingChallenge");
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		Settings = loadProductionModule<SettingModule>("core/database/game/models/Setting").Settings;
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
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

		// Back to the default reference scores, in rows created like at startup, with nothing cached
		const defaultScores = [
			[Settings.KING_CHALLENGE_REFERENCE_SCORES, KingChallengeConstants.DEFAULT_REFERENCE_SCORES.ladder],
			[Settings.KING_CHALLENGE_CHAMPION_SCORES, KingChallengeConstants.DEFAULT_REFERENCE_SCORES.champion]
		] as const;
		for (const [setting, scores] of defaultScores) {
			await setting.getValue();
			await setting.setValue(scores.join(","));
		}
		await kingChallenge.startNewKingChallengeWeek(null);
		await pinInertDailyMission(env);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("announces the winner, resets the tiers with the weekly scores and sets the thresholds of the new week", async () => {
		const seededPlayers = [
			{
				keycloakId: "weekend-champion", weeklyScore: 60_000, kingChallengeTier: KingChallengeConstants.TIER_COUNT
			},
			{
				keycloakId: "weekend-second", weeklyScore: 40_000, kingChallengeTier: 7
			},
			{
				keycloakId: "weekend-third", weeklyScore: 30_000, kingChallengeTier: 6
			},
			{
				keycloakId: "weekend-fourth", weeklyScore: 20_000, kingChallengeTier: 6
			},
			{
				keycloakId: "weekend-fifth", weeklyScore: 10_000, kingChallengeTier: 5
			},
			{
				keycloakId: "weekend-idle", weeklyScore: 1_000, kingChallengeTier: 0
			}
		];
		for (const seededPlayer of seededPlayers) {
			await Player.create(seededPlayer);
		}
		const announcements: TopWeekAnnouncementPacket[] = [];
		vi.spyOn(PacketUtils, "announce").mockImplementation(packet => {
			announcements.push(packet as TopWeekAnnouncementPacket);
		});

		await CrowniclesMonday.topWeekEnd();

		expect(announcements).toEqual([{ winnerKeycloakId: "weekend-champion" }]);
		const players = await Player.findAll({ attributes: ["weeklyScore", "kingChallengeTier"] });
		expect(players.map(player => [player.weeklyScore, player.kingChallengeTier])).toEqual(seededPlayers.map(() => [0, 0]));
		expect(await kingChallenge.getKingChallengeThresholds()).toEqual(KingChallengeConstants.computeThresholds(
			KingChallengeConstants.pushReferenceScores(KingChallengeConstants.DEFAULT_REFERENCE_SCORES, {
				ladder: 10_000,
				champion: 60_000
			})
		));
	});

	async function seedWeekEndingPlayers(): Promise<void> {
		for (const [index, weeklyScore] of [50_000, 40_000, 30_000, 20_000, 10_000].entries()) {
			await Player.create({
				keycloakId: `weekend-retry-${index}`,
				weeklyScore,
				kingChallengeTier: 1
			});
		}
		vi.spyOn(PacketUtils, "announce").mockImplementation(() => undefined);
	}

	it("retries a weekly reset rolled back by a deadlock and applies it exactly once", async () => {
		await seedWeekEndingPlayers();

		// The champion scores are written last: the scores reset and the ladder written by the failed attempt must be rolled back
		vi.spyOn(Settings.KING_CHALLENGE_CHAMPION_SCORES, "setValue").mockRejectedValueOnce(deadlockError());

		// Only the wait between two attempts is skipped, the timers of the database driver keep their delay
		const realSetTimeout = globalThis.setTimeout;
		vi.spyOn(globalThis, "setTimeout").mockImplementation((callback, delay) =>
			realSetTimeout(callback, delay === CrowniclesMonday.WEEK_RESET_RETRY_DELAY_MS ? 0 : delay));

		await CrowniclesMonday.topWeekEnd();

		const players = await Player.findAll({ attributes: ["weeklyScore", "kingChallengeTier"] });
		expect(players.map(player => [player.weeklyScore, player.kingChallengeTier])).toEqual(players.map(() => [0, 0]));
		expect(await kingChallenge.getKingChallengeThresholds()).toEqual(KingChallengeConstants.computeThresholds(
			KingChallengeConstants.pushReferenceScores(KingChallengeConstants.DEFAULT_REFERENCE_SCORES, {
				ladder: 10_000,
				champion: 50_000
			})
		));
	});

	it("does not retry a weekly reset whose outcome is unknown", async () => {
		await seedWeekEndingPlayers();
		const startNewWeek = vi.spyOn(kingChallenge, "startNewKingChallengeWeek");
		vi.spyOn(Settings.KING_CHALLENGE_CHAMPION_SCORES, "setValue").mockRejectedValueOnce(new Error("connection lost"));

		await expect(CrowniclesMonday.topWeekEnd()).rejects.toThrow("connection lost");

		expect(startNewWeek).toHaveBeenCalledOnce();
	});

	async function gainScore(playerId: number, amount: number): Promise<void> {
		const player = (await Player.findByPk(playerId))!;
		await player.addScore({
			response: [],
			amount,
			reason: NumberChangeReason.TEST,
			ignoreBlessing: true
		});
	}

	it("pays a gain blocked by the weekly reset on the thresholds of the new week", async () => {
		const newThresholds = KingChallengeConstants.computeThresholds(
			KingChallengeConstants.pushReferenceScores(KingChallengeConstants.DEFAULT_REFERENCE_SCORES, STRONG_WEEK_SCORES)
		);
		expect(newThresholds[1]).toBeGreaterThan(THRESHOLDS[1]);
		const player = await Player.create({
			keycloakId: "weekend-new-week-gain",
			money: INITIAL_MONEY
		});

		// The reset holds every weekly score while it records the reference scores of the new week
		const recording = createGate();
		const setReferenceScores = Settings.KING_CHALLENGE_REFERENCE_SCORES.setValue.bind(Settings.KING_CHALLENGE_REFERENCE_SCORES);
		vi.spyOn(Settings.KING_CHALLENGE_REFERENCE_SCORES, "setValue").mockImplementationOnce(async value => {
			await recording.pass();
			await setReferenceScores(value);
		});
		const reset = kingChallenge.startNewKingChallengeWeek(STRONG_WEEK_SCORES);
		await recording.reached;
		const gain = gainScore(player.id, THRESHOLDS[1]);
		await sleep(LOCK_WAIT_MS);
		recording.release();
		await Promise.all([reset, gain]);

		// Reaches the second tier of the week ending, but only the first one of the new week
		const rewardedPlayer = (await Player.findByPk(player.id))!;
		expect({
			weeklyScore: rewardedPlayer.weeklyScore,
			tier: rewardedPlayer.kingChallengeTier,
			money: rewardedPlayer.money
		}).toEqual({
			weeklyScore: THRESHOLDS[1],
			tier: 1,
			money: INITIAL_MONEY + KingChallengeConstants.sumRewards(0, 1).money
		});
	});

	it("pays a gain applied before the weekly reset on the thresholds of the week ending", async () => {
		const player = await Player.create({
			keycloakId: "weekend-old-week-gain",
			weeklyScore: THRESHOLDS[0] - 1,
			money: INITIAL_MONEY
		});

		// The gain pauses between its score and the payment of its tier, on the first read of the thresholds
		const payment = createGate();
		const readReferenceScores = Settings.KING_CHALLENGE_REFERENCE_SCORES.getValue.bind(Settings.KING_CHALLENGE_REFERENCE_SCORES);
		vi.spyOn(Settings.KING_CHALLENGE_REFERENCE_SCORES, "getValue").mockImplementationOnce(async () => {
			await payment.pass();
			return await readReferenceScores();
		});
		const gain = gainScore(player.id, 1);
		await payment.reached;
		const reset = kingChallenge.startNewKingChallengeWeek(null);
		await sleep(LOCK_WAIT_MS);
		payment.release();
		await Promise.all([gain, reset]);

		// The tier of the week ending is paid, then the reset starts the new week from scratch
		const rewardedPlayer = (await Player.findByPk(player.id))!;
		expect({
			weeklyScore: rewardedPlayer.weeklyScore,
			tier: rewardedPlayer.kingChallengeTier,
			money: rewardedPlayer.money
		}).toEqual({
			weeklyScore: 0,
			tier: 0,
			money: INITIAL_MONEY + KingChallengeConstants.sumRewards(0, 1).money
		});
	});
});
