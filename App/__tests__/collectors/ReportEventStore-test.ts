import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {SmallEventLotteryWinRes} from "ws-packets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import {SmallEventChoiceResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {
	SmallEventWitchResultRes, WITCH_OUTCOMES
} from "ws-packets/src/fromServer/smallEvents/SmallEventWitchResultRes";
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
		reportEventStore.clearWitch();
				reportEventStore.clearChoice();
		reportEventStore.clearAutomatic();
		reportEventStore.clearTokens();
	});

	it("keeps a pushed event result until the player continues", () => {
		const listener = jest.fn();
		const unsubscribe = reportEventStore.subscribe(listener);
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = outcome();

		registry.dispatch(ReportBigEventResultRes.wireName, result);

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

		registry.dispatch(SmallEventLotteryWinRes.wireName, result);

		expect(reportEventStore.getLotterySnapshot()).toEqual({kind: "win", packet: result});
		reportEventStore.clearLottery();
		expect(reportEventStore.getLotterySnapshot()).toBeNull();
	});

	it("keeps a token result until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result: ReportUseTokensAcceptedRes = {tokensSpent: 2, isArrived: true};

		registry.dispatch(ReportUseTokensAcceptedRes.wireName, result);

		expect(reportEventStore.getTokenSnapshot()).toEqual({kind: "used", packet: result});
		reportEventStore.clearTokens();
		expect(reportEventStore.getTokenSnapshot()).toBeNull();
	});

	it("absorbs a generic mini-event marker without creating UI state", () => {
		const listener = jest.fn();
		const unsubscribe = reportEventStore.subscribe(listener);
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = {eventName: "SmallEventShopRefusePacket", data: {}} as SmallEventResultRes;

		registry.dispatch(SmallEventResultRes.wireName, result);

		expect(listener).not.toHaveBeenCalled();
		unsubscribe();
	});

	it("keeps an automatic mini-event result until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = {eventName: "SmallEventWinHealthPacket", data: {amount: 12}} as SmallEventResultRes;

		registry.dispatch(SmallEventResultRes.wireName, result);

		expect(reportEventStore.getAutomaticSnapshot()).toBe(result);
		reportEventStore.clearAutomatic();
		expect(reportEventStore.getAutomaticSnapshot()).toBeNull();
	});

	it("keeps the detailed witch result until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = {
			ingredientId: "greenApple",
			isIngredient: true,
			forceEffect: false,
			effectId: "sick",
			timeLostMinutes: 0,
			lifeLoss: 10,
			outcome: WITCH_OUTCOMES.POTION
		} as SmallEventWitchResultRes;

		registry.dispatch(SmallEventWitchResultRes.wireName, result);

		expect(reportEventStore.getWitchSnapshot()).toBe(result);
		reportEventStore.clearWitch();
		expect(reportEventStore.getWitchSnapshot()).toBeNull();
	});
});
	it("keeps an interactive small-event result until the player continues", () => {
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		const result = {result: {event: "fightPet", outcome: "success", actionId: "attack", isFemale: false}} as SmallEventChoiceResultRes;

		registry.dispatch(SmallEventChoiceResultRes.wireName, result);

		expect(reportEventStore.getChoiceSnapshot()).toBe(result);
		reportEventStore.clearChoice();
		expect(reportEventStore.getChoiceSnapshot()).toBeNull();
	});
