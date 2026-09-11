import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {COLLECTOR_STOP_REASONS, ReactionCollectorStop} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";
import {CommandGetCurrentReactionCollectorsRes} from "ws-packets/src/fromServer/getCurrentReactionCollectors/GetCurrentReactionCollectorsRes";
import {CITY_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReportStayInCity} from "ws-packets/src/fromServer/report/ReportStayInCity";

function collector(id: string, endTime = Date.now() + 60_000): ReactionCollectorCreation {
	return {
		id,
		endTime,
		data: {
			type: "unknown",
			data: {serverType: "test"}
		},
		reactions: []
	};
}

describe("CollectorsStore", () => {
	beforeEach(() => {
		collectorsStore.reset();
	});

	it("deduplicates a collector and notifies subscribers when it is removed", () => {
		const listener = jest.fn();
		const unsubscribe = collectorsStore.subscribe(listener);
		const item = collector("collector-dedup");

		collectorsStore.track(item);
		collectorsStore.track(item);
		expect(collectorsStore.getSnapshot()).toHaveLength(1);
		expect(listener).toHaveBeenCalledTimes(1);

		collectorsStore.removeExpired(Number.MAX_SAFE_INTEGER);
		expect(collectorsStore.getSnapshot()).toHaveLength(0);
		expect(listener).toHaveBeenCalledTimes(2);
		unsubscribe();
	});

	it("sends a reaction and invalidates through a resolved stop", () => {
		const sendPacket = jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation();
		const resolution = jest.fn();
		const unsubscribe = collectorsStore.subscribeToResolution(resolution);
		const item = collector("collector-resolved");

		collectorsStore.track(item);
		collectorsStore.react(item.id, 0);
		const sentPacket = sendPacket.mock.calls[0]?.[0] as ReactionCollectorReactReq;
		expect(sentPacket.collectorId).toBe(item.id);
		expect(sentPacket.reactionIndex).toBe(0);
		expect(collectorsStore.getSnapshot()).toHaveLength(1);
		expect(collectorsStore.isAnswerPending(item.id)).toBe(true);

		const stop = new ReactionCollectorStop();
		Object.assign(stop, {collectorId: item.id, reason: COLLECTOR_STOP_REASONS.RESOLVED});
		const registeredHandler = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registeredHandler.dispatch(ReactionCollectorStop.wireName, stop);
		expect(collectorsStore.getSnapshot()).toHaveLength(0);
		expect(collectorsStore.isAnswerPending(item.id)).toBe(false);
		expect(resolution).toHaveBeenCalledWith("unknown");
		unsubscribe();
	});

	it("drops an expired collector without asking for a refresh the server will announce", () => {
		const resolution = jest.fn();
		const unsubscribe = collectorsStore.subscribeToResolution(resolution);
		const item = collector("collector-expired");

		collectorsStore.track(item);
		collectorsStore.removeExpired(Number.MAX_SAFE_INTEGER);

		expect(collectorsStore.getSnapshot()).toHaveLength(0);
		expect(resolution).not.toHaveBeenCalled();
		unsubscribe();
	});

	it("refreshes the report when the server confirms an automatic city stay", () => {
		const resolution = jest.fn();
		const unsubscribe = collectorsStore.subscribeToResolution(resolution);
		const registeredHandler = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");

		registeredHandler.dispatch(ReportStayInCity.wireName, new ReportStayInCity());

		expect(resolution).toHaveBeenCalledWith(CITY_DATA_KINDS.CITY);
		unsubscribe();
	});

	it("rehydrates collectors returned after a reconnect", () => {
		const sendPacket = jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation();
		sendPacket.mockClear();
		const current = collector("collector-reconnected");

		collectorsStore.syncCurrent();
		const handlers = sendPacket.mock.calls[0]?.[1];
		const response = new CommandGetCurrentReactionCollectorsRes();
		response.collectors = [current];
		handlers[CommandGetCurrentReactionCollectorsRes.wireName](response as never);

		expect(collectorsStore.getSnapshot()).toEqual([current]);
		collectorsStore.removeExpired(Number.MAX_SAFE_INTEGER);
		sendPacket.mockRestore();
	});

	it("clears collectors and pending answers when the player session ends", () => {
		const sendPacket = jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation();
		const item = collector("collector-from-previous-player");
		collectorsStore.track(item);
		collectorsStore.react(item.id, 0);

		collectorsStore.reset();

		expect(collectorsStore.getSnapshot()).toEqual([]);
		expect(collectorsStore.isAnswerPending(item.id)).toBe(false);
		sendPacket.mockRestore();
	});
});
