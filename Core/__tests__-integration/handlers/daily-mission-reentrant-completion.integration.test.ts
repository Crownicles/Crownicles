import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { DailyMission as DailyMissionType } from "../../src/core/database/game/models/DailyMission";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import type { MissionsCompletedPacket } from "../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionType } from "../../../Lib/src/types/CompletedMission";
import { KingChallengeConstants } from "../../../Lib/src/constants/KingChallengeConstants";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";

type KingChallengeModule = typeof import("../../src/core/kingChallenge/KingChallenge");

const THRESHOLDS = KingChallengeConstants.computeThresholds(KingChallengeConstants.DEFAULT_REFERENCE_SCORES);

const DAILY_GEMS = 3;

const STREAK_MONEY = 100;

const IN_ONE_HOUR = 3_600_000;

const ONE_DAY = 24 * IN_ONE_HOUR;

const STREAK_PROGRESS = 3;

function dailyCompletions(response: CrowniclesPacket[]): number {
	return (response.filter(packet => packet.constructor.name === "MissionsCompletedPacket") as MissionsCompletedPacket[])
		.flatMap(packet => packet.missions)
		.filter(mission => mission.missionType === MissionType.DAILY)
		.length;
}

/**
 * Completing the daily mission also progresses the dailyStreak mission, whose rewards update the missions again
 * in the same transaction. The daily mission is then still progressed by these rewards: it must be paid only once.
 */
describe("daily mission completed by a reentrant mission update", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let DailyMission: ModelStatic<DailyMissionType>;

	beforeAll(async () => {
		env = await setupCoreForTests("dailyreentrant");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		DailyMission = env.crownicles.gameDatabase.sequelize.models.DailyMission as ModelStatic<DailyMissionType>;

		// Creates the setting rows of the king's challenge thresholds, like at startup
		await loadProductionModule<KingChallengeModule>("core/kingChallenge/KingChallenge").getKingChallengeThresholds();
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await DailyMission.destroy({
				truncate: true, force: true
			});
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
	});

	async function seed(params: {
		keycloakId: string;
		dailyMissionId: string;
		weeklyScore: number;
		streakReward: { moneyToWin: number; pointsToWin: number };
	}): Promise<PlayerType> {
		await DailyMission.create({
			id: 0,
			missionId: params.dailyMissionId,
			missionObjective: 1,
			missionVariant: 0,
			gemsToWin: DAILY_GEMS,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});
		const player = await Player.create({
			keycloakId: params.keycloakId,
			weeklyScore: params.weeklyScore,
			score: params.weeklyScore
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			gems: 0
		});

		// Completed by the daily mission, its rewards progress the daily mission again
		await MissionSlot.create({
			playerId: player.id,
			missionId: "dailyStreak",
			missionVariant: 0,
			missionObjective: 1,
			numberDone: 0,
			expiresAt: new Date(Date.now() + IN_ONE_HOUR),
			gemsToWin: 0,
			xpToWin: 0,
			...params.streakReward
		});
		return player;
	}

	async function expectPaidOnce(playerId: number, response: CrowniclesPacket[]): Promise<void> {
		expect(dailyCompletions(response)).toBe(1);
		expect((await PlayerMissionsInfo.findByPk(playerId))!.gems).toBe(DAILY_GEMS);
	}

	it.each([
		{
			case: "keeps the streak of a player who completed the daily mission yesterday",
			daysSinceLastCompletion: 1,
			expectedStreak: STREAK_PROGRESS + 1
		},
		{
			case: "restarts the streak of a player who missed a day",
			daysSinceLastCompletion: 3,
			expectedStreak: 1
		}
	])("$case", async ({
		daysSinceLastCompletion, expectedStreak
	}) => {
		const player = await seed({
			keycloakId: `daily-streak-${daysSinceLastCompletion}`,
			dailyMissionId: "earnMoney",
			weeklyScore: 0,
			streakReward: {
				moneyToWin: 0, pointsToWin: 0
			}
		});
		await MissionSlot.update({
			missionObjective: STREAK_PROGRESS + 10,
			numberDone: STREAK_PROGRESS
		}, { where: { playerId: player.id } });
		await PlayerMissionsInfo.update({ lastDailyMissionCompleted: new Date(Date.now() - daysSinceLastCompletion * ONE_DAY) }, { where: { playerId: player.id } });

		await player.addMoney({
			response: [],
			amount: 1,
			reason: NumberChangeReason.TEST,
			ignoreBlessing: true
		});

		expect((await MissionSlot.findOne({ where: { playerId: player.id } }))!.numberDone).toBe(expectedStreak);
	});

	it("pays once an earnMoney daily mission progressed again by the money of the streak", async () => {
		const player = await seed({
			keycloakId: "daily-reentrant-money",
			dailyMissionId: "earnMoney",
			weeklyScore: 0,
			streakReward: {
				moneyToWin: STREAK_MONEY, pointsToWin: 0
			}
		});
		const response: CrowniclesPacket[] = [];

		await player.addMoney({
			response,
			amount: 1,
			reason: NumberChangeReason.TEST,
			ignoreBlessing: true
		});

		await expectPaidOnce(player.id, response);
	});

	it("pays once an earnTokens daily mission progressed again by a king's challenge tier the streak crosses", async () => {
		const player = await seed({
			keycloakId: "daily-reentrant-tokens",
			dailyMissionId: "earnTokens",
			weeklyScore: THRESHOLDS[0] - 1,
			streakReward: {
				moneyToWin: 0, pointsToWin: 1
			}
		});
		const response: CrowniclesPacket[] = [];

		await player.addTokens({
			response,
			amount: 1,
			reason: NumberChangeReason.TEST
		});

		await expectPaidOnce(player.id, response);
		expect((await Player.findByPk(player.id))!.kingChallengeTier).toBe(1);
	});
});
