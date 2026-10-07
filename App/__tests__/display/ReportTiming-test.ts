import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {reportWaitProgress} from "@/src/display/ReportTiming";

const MINUTE = 60_000;

function travel(values: Partial<ReportTravelSummaryRes>): ReportTravelSummaryRes {
	return {startTime: 0, arriveTime: 100 * MINUTE, lastStopTime: 20 * MINUTE, nextStopTime: 30 * MINUTE, isInCity: false, ...values} as ReportTravelSummaryRes;
}

describe("reportWaitProgress", () => {
	it("measures the wait from the last stop to the next one", () => {
		expect(reportWaitProgress(travel({}), 25 * MINUTE)).toBe(0.5);
	});

	it("waits for the arrival when it comes before the next stop", () => {
		expect(reportWaitProgress(travel({arriveTime: 24 * MINUTE}), 22 * MINUTE)).toBe(0.5);
	});

	it("counts an alteration's wait from when it began", () => {
		const altered = travel({effect: "sleeping", effectEndTime: 50 * MINUTE, effectDuration: 40 * MINUTE, lastStopTime: 50 * MINUTE, nextStopTime: 60 * MINUTE});

		expect(reportWaitProgress(altered, 35 * MINUTE)).toBe(0.5);
	});

	it("stays full once the wait is over, and empty before it starts", () => {
		expect(reportWaitProgress(travel({}), 45 * MINUTE)).toBe(1);
		expect(reportWaitProgress(travel({}), 10 * MINUTE)).toBe(0);
	});

	it("has nothing to follow in a city without alteration", () => {
		expect(reportWaitProgress(travel({isInCity: true}), 25 * MINUTE)).toBeUndefined();
	});
});
