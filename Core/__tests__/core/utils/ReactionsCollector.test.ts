import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		blockPlayerUntil: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: {
		sendPackets: vi.fn()
	}
}));

import {
	ReactionCollectorController, ReactionCollectorInstance
} from "../../../src/core/utils/ReactionsCollector";
import {
	ReactionCollector, ReactionCollectorCreationPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorResetTimerPacketReq, ReactionCollectorResetTimerPacketRes
} from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";

const COLLECTOR_TIME = 60_000;

function buildCollector(): ReactionCollectorInstance {
	const model: Pick<ReactionCollector, "creationPacket"> = {
		creationPacket: (id, endTime, mainPacket) => ({
			id,
			endTime,
			mainPacket,
			reactions: [] as ReactionCollectorCreationPacket["reactions"]
		}) as ReactionCollectorCreationPacket
	};
	const collector = new ReactionCollectorInstance(model as ReactionCollector, {} as PacketContext, { time: COLLECTOR_TIME }, vi.fn());
	collector.build();
	return collector;
}

describe("ReactionCollectorController.resetTimer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("answers with the deadline pushed back by the reset, not the deadline of the creation packet", async () => {
		const collector = buildCollector();
		const creationEndTime = collector.creationPacket.endTime;

		vi.advanceTimersByTime(COLLECTOR_TIME / 2);
		const response: CrowniclesPacket[] = [];
		ReactionCollectorController.resetTimer(response, {
			reactionCollectorId: collector.creationPacket.id
		} as ReactionCollectorResetTimerPacketReq);

		const answer = response[0] as ReactionCollectorResetTimerPacketRes;
		expect(answer.endTime).toBe(Date.now() + COLLECTOR_TIME);
		expect(answer.endTime).toBeGreaterThan(creationEndTime);

		vi.advanceTimersByTime(COLLECTOR_TIME / 2);
		expect(collector.hasEnded).toBeFalsy();

		vi.advanceTimersByTime(COLLECTOR_TIME / 2);
		await vi.runAllTimersAsync();
		expect(collector.hasEnded).toBe(true);
	});
});
