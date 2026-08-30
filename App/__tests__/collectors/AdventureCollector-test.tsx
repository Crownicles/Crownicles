import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	AdventureCollector, BigEventOutcome, HealOutcome, LotteryOutcome, SmallEventOutcome, TokenOutcome
} from "@/src/collectors/AdventureCollector";

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIconOrNull: (): null => null
	}
}));

jest.mock("@/src/collectors/CollectorLabels", () => ({
	collectorDescription: (): string => "small-event-description",
	collectorTitle: (): string => "small-event-title",
	isChoosable: (): boolean => true,
	reactionLabel: (): string => "small-event-choice"
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key
	}
}));

function smallEvent(): ReactionCollectorCreation {
	return {
		id: "small-event",
		endTime: Date.now() + 60_000,
		data: {
			type: SMALL_EVENT_DATA_KINDS.ALTAR,
			data: {poolAmount: 10, poolThreshold: 100}
		},
		reactions: [{
			type: SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			data: {amount: 5}
		}]
	};
}

function bigEventOutcome(): ReportBigEventResultRes {
	return {
		eventId: 19,
		possibilityId: "cook",
		outcomeId: "success",
		score: 15,
		experience: 10,
		effect: {name: "slowed", time: 15 * 60_000},
		health: -3,
		money: 20,
		energy: -2,
		gems: 1,
		tokens: 0,
		oneshot: false
	};
}

describe("AdventureCollector", () => {
	it("uses the Adventure tab composition for a mini-event and submits its indexed choice", async () => {
		const onChoose = jest.fn();
		await render(<AdventureCollector collector={smallEvent()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.smallEvent.eyebrow")).toBeTruthy();
		expect(screen.getByText("small-event-title")).toBeTruthy();
		expect(screen.getByText("small-event-description")).toBeTruthy();
		await fireEvent.press(screen.getByText("small-event-choice"));

		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("shows a big-event outcome before the player continues", async () => {
		const onContinue = jest.fn();
		await render(<BigEventOutcome outcome={bigEventOutcome()} onContinue={onContinue} />);

		expect(screen.getByText("events:19.possibilities.cook.outcomes.success")).toBeTruthy();
		expect(screen.getByText("app:adventure.event.fields.money")).toBeTruthy();
		expect(screen.getByText("+20")).toBeTruthy();
		expect(screen.getByText("app:adventure.event.fields.timeLost")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.event.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("renders the confirmation before spending travel tokens", async () => {
		const onChoose = jest.fn();
		const collector: ReactionCollectorCreation = {
			id: "use-tokens",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 2, playerTokens: 5}},
			reactions: [
				{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		};

		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.tokens.fields.cost")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.tokens.use.confirm"));

		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("renders the alteration cure confirmation with the server price", async () => {
		const onChoose = jest.fn();
		const collector: ReactionCollectorCreation = {
			id: "buy-heal",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}},
			reactions: [
				{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		};

		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.heal.use.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.heal.fields.cost")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.heal.use.confirm"));

		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("uses the merchant's server-provided bundles and limits", async () => {
		const onChoose = jest.fn();
		const collector: ReactionCollectorCreation = {
			id: "merchant",
			endTime: Date.now() + 60_000,
			data: {
				type: REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT,
				data: {pricePerToken: 375, playerMoney: 2_000, playerTokens: 0, maxTokens: 20, maxDaily: 10, maxWeekly: 30, amounts: [1, 5]}
			},
			reactions: [
				{type: REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, data: {amount: 1}},
				{type: REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, data: {amount: 5}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		};

		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.tokens.merchant.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.tokens.fields.balance")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.tokens.merchant.buyOne"));

		expect(onChoose).toHaveBeenCalledWith(0);
	});

	it("shows the token result before returning to the journey", async () => {
		const onContinue = jest.fn();
		await render(<TokenOutcome outcome={{kind: "used", packet: {tokensSpent: 2, isArrived: true}}} onContinue={onContinue} />);

		expect(screen.getAllByText("app:adventure.tokens.outcomes.used")).toHaveLength(1);
		expect(screen.getByText("app:adventure.tokens.fields.spent")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.tokens.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("shows the cure result before returning to the journey", async () => {
		const onContinue = jest.fn();
		await render(<HealOutcome outcome={{kind: "accepted", packet: {healPrice: 410, isArrived: false}}} onContinue={onContinue} />);

		expect(screen.getByText("app:adventure.heal.outcomes.accepted")).toBeTruthy();
		expect(screen.getByText("app:adventure.heal.fields.spent")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.heal.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("shows the reward and the lost time sent by the lottery", async () => {
		const onContinue = jest.fn();
		await render(<LotteryOutcome
			outcome={{
				kind: "win",
				packet: {lostTime: 15 * 60_000, winAmount: 40, winReward: "money", level: "medium"}
			}}
			onContinue={onContinue}
		/>);

		expect(screen.getByText("app:adventure.lottery.resultTitle")).toBeTruthy();
		expect(screen.getByText("app:adventure.lottery.win")).toBeTruthy();
		expect(screen.getByText("app:adventure.lottery.rewards.money")).toBeTruthy();
		expect(screen.getByText("+40")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("shows a generic result for an altar resolution", async () => {
		const onContinue = jest.fn();
		await render(<SmallEventOutcome
			outcome={{
				eventName: "SmallEventAltarContributedPacket",
				data: {amount: 130, blessingTriggered: false}
			}}
			onContinue={onContinue}
		/>);

		expect(screen.getByText("app:adventure.smallEvent.resultTitle")).toBeTruthy();
		expect(screen.getByText("Amount")).toBeTruthy();
		expect(screen.getByText("130")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.smallEvent.continue"));

		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
