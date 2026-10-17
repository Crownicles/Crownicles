import {
	beforeEach, describe, expect, it, vi
} from "vitest";

const { logKingGuardFightMock } = vi.hoisted(() => ({ logKingGuardFightMock: vi.fn() }));

vi.mock("../../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logKingGuardFight: logKingGuardFightMock } }
}));
vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: {},
	Players: { getById: vi.fn() }
}));
vi.mock("../../../../src/core/database/logs/LogsReadRequests", () => ({
	LogsReadRequests: { getPersonalInitiatedFightDailySummary: vi.fn() }
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
vi.mock("../../../../src/core/fights/kingGuards/KingGuardGenerator", () => ({
	generateKingGuard: vi.fn()
}));

import { kingGuardFightEndCallback } from "../../../../src/commands/player/KingGuardFightCommand";
import { Players } from "../../../../src/core/database/game/models/Player";
import { LogsReadRequests } from "../../../../src/core/database/logs/LogsReadRequests";
import { KingGuardFightRewardPacket } from "../../../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

const WIN_MONEY_REWARD = 400;

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
	const initiator = { player: { id: 1 } };
	const guard = { player: { keycloakId: FightConstants.KING_GUARD.KEYCLOAK_ID } };
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

	beforeEach(() => {
		vi.clearAllMocks();
		player = buildPlayer();
		vi.mocked(Players.getById).mockResolvedValue(player as never);
		vi.mocked(LogsReadRequests.getPersonalInitiatedFightDailySummary).mockResolvedValue({
			played: 1, won: 1, draw: 0
		});
	});

	it("logs the guard fight and rewards money and score like a ranked fight, without any glory change", async () => {
		const {
			fight, guard
		} = buildFight("win");
		const response: unknown[] = [];

		await kingGuardFightEndCallback(fight, guard, response as never);

		expect(logKingGuardFightMock).toHaveBeenCalledWith(fight, guard);
		expect(player.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: WIN_MONEY_REWARD }));
		expect(player.addScore).toHaveBeenCalledWith(expect.objectContaining({ amount: FightConstants.REWARDS.SCORE_BONUS_AWARD }));
		expect(player.setGloryPoints).not.toHaveBeenCalled();
		const packet = response.at(-1) as KingGuardFightRewardPacket;
		expect(packet).toBeInstanceOf(KingGuardFightRewardPacket);
		expect(packet).toMatchObject({
			money: WIN_MONEY_REWARD,
			points: FightConstants.REWARDS.SCORE_BONUS_AWARD,
			won: true,
			draw: false
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
