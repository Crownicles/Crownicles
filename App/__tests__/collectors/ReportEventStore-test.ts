import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {SmallEventLotteryWinRes} from "ws-packets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {ReportUseTokensAcceptedRes} from "ws-packets/src/fromServer/report/ReportTokenRes";
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
		reportEventStore.clearLottery();
		reportEventStore.clearSmallEvent();
		reportEventStore.clearTokens();
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

	it("keeps the lottery resolution until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result: SmallEventLotteryWinRes = {
			lostTime: 300_000,
			winAmount: 40,
			winReward: "money",
			level: "medium"
		};

		registry.dispatch(SmallEventLotteryWinRes.name, result);

		expect(reportEventStore.getLotterySnapshot()).toEqual({kind: "win", packet: result});
		reportEventStore.clearLottery();
		expect(reportEventStore.getLotterySnapshot()).toBeNull();
	});

	it("keeps a token result until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result: ReportUseTokensAcceptedRes = {tokensSpent: 2, isArrived: true};

		registry.dispatch(ReportUseTokensAcceptedRes.name, result);

		expect(reportEventStore.getTokenSnapshot()).toEqual({kind: "used", packet: result});
		reportEventStore.clearTokens();
		expect(reportEventStore.getTokenSnapshot()).toBeNull();
	});

	it("keeps a generic mini-event resolution until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result: SmallEventResultRes = {
			eventName: "SmallEventAltarContributedPacket",
			data: {amount: 130, blessingTriggered: false}
		};

		registry.dispatch(SmallEventResultRes.name, result);

		expect(reportEventStore.getSmallEventSnapshot()).toBe(result);
		reportEventStore.clearSmallEvent();
		expect(reportEventStore.getSmallEventSnapshot()).toBeNull();
	});
});
