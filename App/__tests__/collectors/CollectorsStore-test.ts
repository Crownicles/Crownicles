import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {COLLECTOR_STOP_REASONS, ReactionCollectorStop} from "ws-packets/src/fromServer/common/ReactionCollectorStop";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ReactionCollectorReactReq} from "ws-packets/src/fromClient/ReactionCollectorReactReq";

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
		collectorsStore.removeExpired(Number.MAX_SAFE_INTEGER);
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
		expect(collectorsStore.getSnapshot()).toHaveLength(0);

		const stop = new ReactionCollectorStop();
		Object.assign(stop, {collectorId: item.id, reason: COLLECTOR_STOP_REASONS.RESOLVED});
		const registeredHandler = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registeredHandler.dispatch(ReactionCollectorStop.name, stop);
		expect(resolution).toHaveBeenCalledWith("unknown");
		unsubscribe();
	});
});
