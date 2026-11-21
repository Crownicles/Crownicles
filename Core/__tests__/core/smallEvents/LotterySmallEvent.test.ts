import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/lottery";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	ReactionCollectorLotteryEasyReaction, ReactionCollectorLotteryHardReaction, ReactionCollectorLotteryMediumReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {
	SmallEventLotteryLosePacket, SmallEventLotteryNoAnswerPacket, SmallEventLotteryPoorPacket, SmallEventLotteryWinPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import {
	createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, packetsOf, reactWith, runSmallEvent, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

const REWARDS = SmallEventConstants.LOTTERY.REWARDS;
const TYPES = SmallEventConstants.LOTTERY.REWARD_TYPES;
const LOST_TIME = 10;

type TestGuild = {
	experience: number;
	isAtMaxLevel: () => boolean;
	addExperience: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
};

function mockGuild(atMaxLevel = false): TestGuild {
	const guild: TestGuild = {
		experience: 0,
		isAtMaxLevel: () => atMaxLevel,
		addExperience: vi.fn((parameters: { amount: number }) => {
			guild.experience += parameters.amount;
			return Promise.resolve();
		}),
		save: vi.fn().mockResolvedValue(undefined)
	};
	vi.spyOn(Guilds, "ofPlayer").mockResolvedValue(guild as never);
	return guild;
}

function mockDraw(rewardType: string, ...successes: boolean[]): ReturnType<typeof vi.spyOn> {
	vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(rewardType) ? rewardType : list[0]) as never);
	const bool = vi.spyOn(RandomUtils.crowniclesRandom, "bool");
	for (const success of successes) {
		bool.mockReturnValueOnce(success);
	}
	return bool;
}

async function play(player: TestPlayer, level: { name: string }): Promise<ReturnType<typeof reactWith>> {
	return reactWith(await runSmallEvent(smallEventFuncs, player), level);
}

describe("lottery small event", () => {
	useSmallEventHarness();
	let applyEffect: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		applyEffect = vi.spyOn(TravelTime, "applyEffect").mockResolvedValue();
		vi.spyOn(Guilds, "ofPlayer").mockResolvedValue(null);
		vi.spyOn(BlessingManager.getInstance(), "getMoneyMultiplier").mockReturnValue(1.5);
	});

	it("offers the three levels to the player only", async () => {
		const run = await runSmallEvent(smallEventFuncs, createTestPlayer());
		expect(run.collector?.creationPacket.reactions.map(reaction => reaction.type)).toEqual([
			ReactionCollectorLotteryEasyReaction.name,
			ReactionCollectorLotteryMediumReaction.name,
			ReactionCollectorLotteryHardReaction.name
		]);
		expect(run.response).toContain(run.collector?.creationPacket);
		expect(await ignoresOtherPlayers(run)).toBe(true);
	});

	it("answers without any change when the player does not choose", async () => {
		const player = createTestPlayer();
		const response = await endWithoutReaction(await runSmallEvent(smallEventFuncs, player));

		expect(packetsOf(response, SmallEventLotteryNoAnswerPacket)).toHaveLength(1);
		expect(isBlocked(player)).toBe(false);
		expect(player.money).toBe(1000);
		expect(applyEffect).not.toHaveBeenCalled();
	});

	it("wins easy experience at the easy success rate without losing time", async () => {
		const player = createTestPlayer();
		const bool = mockDraw(TYPES.XP, true);

		const response = await play(player, ReactionCollectorLotteryEasyReaction);

		expect(isBlocked(player)).toBe(false);
		expect(bool).toHaveBeenCalledWith(0.8);
		expect(player.experience).toBe(REWARDS.EXPERIENCE);
		expect(packetOf(response, SmallEventLotteryWinPacket)).toMatchObject({
			winAmount: REWARDS.EXPERIENCE, lostTime: 0, level: "easy", winReward: TYPES.XP
		});
		expect(applyEffect).not.toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
	});

	it("wins three times the money at the medium level, shows the blessed amount and makes the player lose time", async () => {
		const player = createTestPlayer();
		const bool = mockDraw(TYPES.MONEY, true);

		const response = await play(player, ReactionCollectorLotteryMediumReaction);

		expect(bool).toHaveBeenCalledWith(0.5);
		expect(player.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: REWARDS.MONEY * 3 }));
		expect(packetOf(response, SmallEventLotteryWinPacket)).toMatchObject({
			winAmount: Math.round(REWARDS.MONEY * 3 * 1.5), lostTime: LOST_TIME, level: "medium", winReward: TYPES.MONEY
		});
		expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, LOST_TIME, expect.any(Date), expect.anything());
	});

	it("wins ten times the points at the hard level", async () => {
		const player = createTestPlayer();
		const bool = mockDraw(TYPES.POINTS, true);

		const response = await play(player, ReactionCollectorLotteryHardReaction);

		expect(bool).toHaveBeenCalledWith(0.2);
		expect(player.score).toBe(REWARDS.POINTS * 10);
		expect(packetOf(response, SmallEventLotteryWinPacket)).toMatchObject({
			winAmount: REWARDS.POINTS * 10, lostTime: LOST_TIME, level: "hard", winReward: TYPES.POINTS
		});
	});

	it("gives the guild experience to the guild of the player", async () => {
		const player = createTestPlayer();
		const guild = mockGuild();
		mockDraw(TYPES.GUILD_XP, true);

		const response = await play(player, ReactionCollectorLotteryMediumReaction);

		expect(guild.experience).toBe(REWARDS.GUILD_EXPERIENCE * 3);
		expect(guild.save).toHaveBeenCalled();
		expect(packetOf(response, SmallEventLotteryWinPacket)).toMatchObject({
			winAmount: REWARDS.GUILD_EXPERIENCE * 3, winReward: TYPES.GUILD_XP
		});
	});

	it.each([
		["has no guild", false],
		["has a guild at its max level", true]
	])("never draws the guild experience when the player %s", async (_case, hasMaxLevelGuild) => {
		const player = createTestPlayer();
		if (hasMaxLevelGuild) {
			mockGuild(true);
		}
		mockDraw(TYPES.GUILD_XP, true);

		const response = await play(player, ReactionCollectorLotteryMediumReaction);

		expect(packetOf(response, SmallEventLotteryWinPacket)).toMatchObject({
			winAmount: REWARDS.EXPERIENCE * 3, winReward: TYPES.XP
		});
		expect(player.experience).toBe(REWARDS.EXPERIENCE * 3);
	});

	it("refuses the hard level to a player who cannot pay the malus", async () => {
		const player = createTestPlayer({ money: SmallEventConstants.LOTTERY.MONEY_MALUS - 1 });

		const response = await play(player, ReactionCollectorLotteryHardReaction);

		expect(packetsOf(response, SmallEventLotteryPoorPacket)).toHaveLength(1);
		expect(packetsOf(response, SmallEventLotteryLosePacket)).toHaveLength(0);
		expect(applyEffect).not.toHaveBeenCalled();
	});

	it("lets a player who cannot pay the malus play the lower levels", async () => {
		const player = createTestPlayer({ money: 0 });
		mockDraw(TYPES.XP, true);

		const response = await play(player, ReactionCollectorLotteryMediumReaction);

		expect(packetsOf(response, SmallEventLotteryPoorPacket)).toHaveLength(0);
		expect(packetsOf(response, SmallEventLotteryWinPacket)).toHaveLength(1);
	});

	it("lets a player who can just pay the malus play the hard level", async () => {
		const player = createTestPlayer({ money: SmallEventConstants.LOTTERY.MONEY_MALUS });
		mockDraw(TYPES.XP, false, true);

		const response = await play(player, ReactionCollectorLotteryHardReaction);

		expect(packetsOf(response, SmallEventLotteryPoorPacket)).toHaveLength(0);
		expect(packetOf(response, SmallEventLotteryLosePacket)).toMatchObject({
			moneyLost: SmallEventConstants.LOTTERY.MONEY_MALUS, lostTime: LOST_TIME, level: "hard"
		});
		expect(player.money).toBe(0);
		expect(player.save).toHaveBeenCalled();
	});

	it("lets the player off without paying when the second hard draw fails", async () => {
		const player = createTestPlayer();
		mockDraw(TYPES.XP, false, false);

		const response = await play(player, ReactionCollectorLotteryHardReaction);

		expect(packetOf(response, SmallEventLotteryLosePacket)).toMatchObject({
			moneyLost: 0, lostTime: LOST_TIME, level: "hard"
		});
		expect(player.money).toBe(1000);
	});

	it("never takes money when losing below the hard level", async () => {
		const player = createTestPlayer();
		const bool = mockDraw(TYPES.XP, false, true);

		const response = await play(player, ReactionCollectorLotteryMediumReaction);

		expect(bool).toHaveBeenCalledTimes(1);
		expect(packetOf(response, SmallEventLotteryLosePacket)).toMatchObject({
			moneyLost: 0, lostTime: LOST_TIME, level: "medium"
		});
		expect(player.money).toBe(1000);
		expect(player.experience).toBe(0);
	});
});
