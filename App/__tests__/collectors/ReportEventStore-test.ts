import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {reportEventStore} from "@/src/collectors/ReportEventStore";

function outcome(): ReportBigEventResultRes {
	return {
		eventId: 19,
		possibilityId: "cook",
		outcomeId: "success",
		score: 15,
		experience: 10,
		health: -3,
		money: 20,
		energy: -2,
		gems: 1,
		tokens: 0,
		oneshot: false
	};
}

describe("ReportEventStore", () => {
	beforeEach((): void => {
		reportEventStore.clear();
	});

	it("keeps a pushed event result until the player continues", () => {
		const listener = jest.fn();
		const unsubscribe = reportEventStore.subscribe(listener);
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = outcome();

		registry.dispatch(ReportBigEventResultRes.name, result);

		expect(reportEventStore.getSnapshot()).toBe(result);
		expect(listener).toHaveBeenCalledTimes(1);
		reportEventStore.clear();
		expect(reportEventStore.getSnapshot()).toBeNull();
		expect(listener).toHaveBeenCalledTimes(2);
		unsubscribe();
	});
});
