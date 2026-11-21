import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/limoges";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	ReactionCollectorAcceptReaction, ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	SmallEventLimogesPacket, SmallEventLimogesPenaltyType
} from "../../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import {
	createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, reactWith, runSmallEvent, SmallEventRun, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

// Questions of resources/smallEvents/limoges.json
const QUESTION_TO_ACCEPT = "journeyInvitation";
const QUESTION_TO_REFUSE = "seenBetterCity";
const MONEY_PENALTY_MAX = 120;

/**
 * Draw the given question and, for a penalty, the given type when it is available
 */
function mockDraws(questionId: string, penaltyType = SmallEventLimogesPenaltyType.MONEY): void {
	vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => {
		const question = list.find(element => (element as { id?: string }).id === questionId);
		return (question ?? (list.includes(penaltyType) ? penaltyType : list[0])) as never;
	});
	// One more than the minimum of each range, to tell the ranges apart
	vi.spyOn(RandomUtils, "rangedInt").mockImplementation(range => range.MIN + 1);
}

async function meet(player: TestPlayer, questionId: string, penaltyType?: SmallEventLimogesPenaltyType): Promise<SmallEventRun> {
	mockDraws(questionId, penaltyType);
	return await runSmallEvent(smallEventFuncs, player);
}

describe("limoges small event", () => {
	useSmallEventHarness();
	let applyEffect: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		applyEffect = vi.spyOn(TravelTime, "applyEffect").mockResolvedValue();
	});

	it("asks the drawn question to the player only", async () => {
		const run = await meet(createTestPlayer(), QUESTION_TO_ACCEPT);

		expect(run.response).toContain(run.collector?.creationPacket);
		expect(run.collector?.creationPacket.data.data).toMatchObject({ questionId: QUESTION_TO_ACCEPT });
		expect(await ignoresOtherPlayers(run)).toBe(true);
	});

	it.each([
		[QUESTION_TO_ACCEPT, ReactionCollectorAcceptReaction, true],
		[QUESTION_TO_REFUSE, ReactionCollectorRefuseReaction, false]
	])("rewards the right answer to %s with experience and score", async (questionId, answer, shouldAccept) => {
		const player = createTestPlayer();

		const response = await reactWith(await meet(player, questionId), answer);

		expect(packetOf(response, SmallEventLimogesPacket)).toEqual(expect.objectContaining({
			questionId, shouldHaveAccepted: shouldAccept, isSuccess: true, reward: {
				experience: 31, score: 11
			}
		}));
		expect(player.experience).toBe(31);
		expect(player.score).toBe(11);
		expect(player.save).toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	it.each([
		[QUESTION_TO_ACCEPT, ReactionCollectorRefuseReaction],
		[QUESTION_TO_REFUSE, ReactionCollectorAcceptReaction]
	])("takes money for the wrong answer to %s", async (questionId, answer) => {
		const player = createTestPlayer({ money: 1000 });

		const response = await reactWith(await meet(player, questionId, SmallEventLimogesPenaltyType.MONEY), answer);

		const packet = packetOf(response, SmallEventLimogesPacket);
		expect(packet).toMatchObject({
			isSuccess: false, penalty: {
				type: SmallEventLimogesPenaltyType.MONEY, amount: 46
			}
		});
		expect(packet.reward).toBeUndefined();
		expect(player.money).toBe(954);
		expect(player.experience).toBe(0);
		expect(player.save).toHaveBeenCalled();
	});

	it("punishes a player who does not answer, even to a question to refuse", async () => {
		const player = createTestPlayer();

		const response = await endWithoutReaction(await meet(player, QUESTION_TO_REFUSE, SmallEventLimogesPenaltyType.HEALTH));

		expect(packetOf(response, SmallEventLimogesPacket)).toMatchObject({
			isSuccess: false, penalty: {
				type: SmallEventLimogesPenaltyType.HEALTH, amount: 4
			}
		});
		expect(player.health).toBe(96);
		expect(player.save).toHaveBeenCalled();
	});

	it("makes the player lose time as a penalty", async () => {
		const player = createTestPlayer();

		const response = await reactWith(await meet(player, QUESTION_TO_ACCEPT, SmallEventLimogesPenaltyType.TIME), ReactionCollectorRefuseReaction);

		expect(packetOf(response, SmallEventLimogesPacket).penalty).toEqual({
			type: SmallEventLimogesPenaltyType.TIME, amount: 9
		});
		expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, 9, expect.any(Date), expect.anything());
		expect(player.health).toBe(100);
		expect(player.money).toBe(1000);
	});

	it("takes money from a player who can just afford the maximum loss", async () => {
		const player = createTestPlayer({ money: MONEY_PENALTY_MAX });

		const response = await reactWith(await meet(player, QUESTION_TO_ACCEPT), ReactionCollectorRefuseReaction);

		expect(packetOf(response, SmallEventLimogesPacket).penalty?.type).toBe(SmallEventLimogesPenaltyType.MONEY);
	});

	it("never takes money from a player who cannot afford the maximum loss", async () => {
		const player = createTestPlayer({ money: MONEY_PENALTY_MAX - 1 });

		const response = await reactWith(await meet(player, QUESTION_TO_ACCEPT), ReactionCollectorRefuseReaction);

		expect(packetOf(response, SmallEventLimogesPacket).penalty?.type).not.toBe(SmallEventLimogesPenaltyType.MONEY);
		expect(player.money).toBe(MONEY_PENALTY_MAX - 1);
	});
});
