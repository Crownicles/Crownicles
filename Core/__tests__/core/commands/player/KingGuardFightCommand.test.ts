import {
	beforeEach, describe, expect, it, onTestFinished, vi
} from "vitest";

const {
	logKingGuardFightMock, withLockedEntitiesMock
} = vi.hoisted(() => ({
	logKingGuardFightMock: vi.fn(),
	withLockedEntitiesMock: vi.fn()
}));

vi.mock("../../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logKingGuardFight: logKingGuardFightMock } }
}));
vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: {
		lockKey: (id: number): unknown => ({
			model: "Player", id
		})
	},
	Players: { getById: vi.fn() }
}));
vi.mock("../../../../src/core/database/game/models/KingGuardState", () => ({
	KingGuardState: {
		lockKey: (id: number): unknown => ({
			model: "KingGuardState", id
		})
	},
	KingGuardStates: {}
}));
vi.mock("../../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: withLockedEntitiesMock
}));
vi.mock("../../../../src/core/database/logs/LogsReadRequests", () => ({
	LogsReadRequests: { getPersonalInitiatedFightDailySummary: vi.fn() }
}));
vi.mock("../../../../src/core/database/logs/requests/LogsKingGuardFightsRequests", () => ({
	LogsKingGuardFightsRequests: { countRatedFights: vi.fn() }
}));
vi.mock("../../../../src/core/blessings/BlessingManager", () => ({
	BlessingManager: {
		getInstance: (): unknown => ({
			getFightLootMultiplier: (): number => 1,
			getScoreMultiplier: (): number => 1,
			applyMoneyBlessing: (amount: number): number => amount
		})
	}
}));

import { kingGuardFightEndCallback } from "../../../../src/commands/player/KingGuardFightCommand";
import { Players } from "../../../../src/core/database/game/models/Player";
import { LogsReadRequests } from "../../../../src/core/database/logs/LogsReadRequests";
import { LogsKingGuardFightsRequests } from "../../../../src/core/database/logs/requests/LogsKingGuardFightsRequests";
import { KingGuardFightRewardPacket } from "../../../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { LockedRowNotFoundError } from "../../../../../Lib/src/locks/withLockedEntities";
import { getInitialPlayerGuardGlory } from "../../../../src/core/fights/kingGuards/KingGuardRating";
import { KingGuardIdentity } from "../../../../../Lib/src/utils/KingGuardIdentity";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

const WIN_MONEY_REWARD = 400;
const GUARD_ID = 321;
const PLAYER_LEVEL = 130;
const {
	PROVISIONAL_FIGHTS, PROVISIONAL_PLAYER_K_FACTOR, PLAYER_K_FACTOR, GUARD_K_FACTOR
} = FightConstants.KING_GUARD.RATING;

type LockedRow = Record<string, unknown> & { save: ReturnType<typeof vi.fn> };

function buildPlayer(): Record<string, ReturnType<typeof vi.fn> | string | number> {
	return {
		id: 1,
		keycloakId: "player",
		getLeague: vi.fn().mockReturnValue({ getFightWinMoneyReward: () => WIN_MONEY_REWARD }),
		addMoney: vi.fn(),
		addScore: vi.fn(),
		setGloryPoints: vi.fn()
	};
}

function buildFight(outcome: "win" | "loss" | "draw"): {
	fight: never; guard: never;
} {
	const initiator = {
		player: {
			id: 1, keycloakId: "player"
		}
	};
	const guard = {
		player: { keycloakId: KingGuardIdentity.toKeycloakId(GUARD_ID) },
		guardData: {
			id: GUARD_ID, sex: "f"
		}
	};
	const fight = {
		fightInitiator: initiator,
		isADraw: (): boolean => outcome === "draw",
		getWinnerFighter: (): unknown => (outcome === "loss" ? guard : initiator),
		getPostFightPetLoveChange: (): null => null
	};
	return {
		fight: fight as never,
		guard: guard as never
	};
}

describe("kingGuardFightEndCallback", () => {
	let player: ReturnType<typeof buildPlayer>;
	let lockedPlayer: LockedRow;
	let lockedGuard: LockedRow;

	beforeEach(() => {
		vi.clearAllMocks();
		player = buildPlayer();
		lockedPlayer = {
			id: 1, level: PLAYER_LEVEL, guardGloryPoints: 1500, fightCountdown: 3, save: vi.fn()
		};
		lockedGuard = {
			id: GUARD_ID, glory: 1500, wins: 4, losses: 2, draws: 1, save: vi.fn()
		};
		withLockedEntitiesMock.mockImplementation((_keys: unknown, body: (rows: unknown[]) => unknown) => body([lockedPlayer, lockedGuard]));
		vi.mocked(Players.getById).mockResolvedValue(player as never);
		vi.mocked(LogsReadRequests.getPersonalInitiatedFightDailySummary).mockResolvedValue({
			played: 1, won: 1, draw: 0
		});
		vi.mocked(LogsKingGuardFightsRequests.countRatedFights).mockResolvedValue(PROVISIONAL_FIGHTS);
	});

	it("moves the hidden ratings of the player and of the guard, counts the fight in the activity and logs them", async () => {
		const {
			fight, guard
		} = buildFight("win");

		await kingGuardFightEndCallback(fight, guard, [] as never);

		expect(withLockedEntitiesMock).toHaveBeenCalledWith([
			{
				model: "Player", id: 1
			},
			{
				model: "KingGuardState", id: GUARD_ID
			}
		], expect.any(Function));
		expect(lockedPlayer.guardGloryPoints).toBe(1500 + PLAYER_K_FACTOR / 2);
		expect(lockedPlayer.fightCountdown).toBe(2);
		expect(lockedGuard).toMatchObject({
			glory: 1500 - GUARD_K_FACTOR / 2, losses: 3, wins: 4, draws: 1
		});
		expect(lockedPlayer.save).toHaveBeenCalled();
		expect(lockedGuard.save).toHaveBeenCalled();
		expect(logKingGuardFightMock).toHaveBeenCalledWith(fight, guard, {
			playerGuardGlory: 1500,
			playerGuardGloryChange: PLAYER_K_FACTOR / 2,
			guardGlory: 1500,
			guardGloryChange: -GUARD_K_FACTOR / 2
		});
	});

	it("raises the guard that beats the player and counts its victory", async () => {
		const {
			fight, guard
		} = buildFight("loss");

		await kingGuardFightEndCallback(fight, guard, [] as never);

		expect(lockedPlayer.guardGloryPoints).toBeLessThan(1500);
		expect(lockedGuard).toMatchObject({
			glory: 1500 + GUARD_K_FACTOR / 2, wins: 5, losses: 2
		});
	});

	it("starts a player who never fought a guard from the rating of its level, and moves it faster during its first fights", async () => {
		lockedPlayer.guardGloryPoints = null;
		lockedGuard.glory = getInitialPlayerGuardGlory(PLAYER_LEVEL);
		vi.mocked(LogsKingGuardFightsRequests.countRatedFights).mockResolvedValue(0);
		const {
			fight, guard
		} = buildFight("win");

		await kingGuardFightEndCallback(fight, guard, [] as never);

		expect(lockedPlayer.guardGloryPoints).toBe(getInitialPlayerGuardGlory(PLAYER_LEVEL) + PROVISIONAL_PLAYER_K_FACTOR / 2);
	});

	it("still rewards the player when its row or the one of the guard vanished, logging the fight without ratings", async () => {
		withLockedEntitiesMock.mockRejectedValue(new LockedRowNotFoundError("king_guards", GUARD_ID));
		const warnSpy = vi.spyOn(CrowniclesLogger, "warn").mockImplementation((): void => undefined);
		onTestFinished(() => warnSpy.mockRestore());
		const {
			fight, guard
		} = buildFight("win");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect(warnSpy).toHaveBeenCalled();
		expect(logKingGuardFightMock).toHaveBeenCalledWith(fight, guard, null);
		expect(player.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: WIN_MONEY_REWARD }));
	});

	it("rewards money and score like a ranked fight, without any glory change, and names the guard to the front", async () => {
		const {
			fight, guard
		} = buildFight("win");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect(player.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: WIN_MONEY_REWARD }));
		expect(player.addScore).toHaveBeenCalledWith(expect.objectContaining({ amount: FightConstants.REWARDS.SCORE_BONUS_AWARD }));
		expect(player.setGloryPoints).not.toHaveBeenCalled();
		const packet = response.at(-1) as KingGuardFightRewardPacket;
		expect(packet).toBeInstanceOf(KingGuardFightRewardPacket);
		expect(packet).toMatchObject({
			money: WIN_MONEY_REWARD,
			points: FightConstants.REWARDS.SCORE_BONUS_AWARD,
			won: true,
			draw: false,
			guard: {
				id: GUARD_ID, sex: "f"
			}
		});
	});

	it("reports the money and score actually credited, as modified by the blessings applied in addMoney and addScore", async () => {
		const creditedMoneyMultiplier = 2;
		const creditedScoreMultiplier = 3;
		vi.mocked(player.addMoney as ReturnType<typeof vi.fn>).mockImplementation((parameters: { amount: number }): void => {
			parameters.amount *= creditedMoneyMultiplier;
		});
		vi.mocked(player.addScore as ReturnType<typeof vi.fn>).mockImplementation((parameters: { amount: number }): void => {
			parameters.amount *= creditedScoreMultiplier;
		});
		const {
			fight, guard
		} = buildFight("win");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect(response.at(-1)).toMatchObject({
			money: WIN_MONEY_REWARD * creditedMoneyMultiplier,
			points: FightConstants.REWARDS.SCORE_BONUS_AWARD * creditedScoreMultiplier
		});
	});

	it("shares the daily money cap of ranked fights", async () => {
		vi.mocked(LogsReadRequests.getPersonalInitiatedFightDailySummary).mockResolvedValue({
			played: FightConstants.REWARDS.MAX_REWARDED_WINS + 1,
			won: FightConstants.REWARDS.MAX_REWARDED_WINS + 1,
			draw: 0
		});
		const {
			fight, guard
		} = buildFight("win");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect((response.at(-1) as KingGuardFightRewardPacket).money).toBe(0);
	});

	it("reports a loss against the guard", async () => {
		const {
			fight, guard
		} = buildFight("loss");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect(response.at(-1)).toMatchObject({
			won: false,
			draw: false,
			money: FightConstants.REWARDS.LOSS_MONEY_BONUS,
			points: 0
		});
	});
});
