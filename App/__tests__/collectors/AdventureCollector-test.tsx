import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS, CITY_DATA_KINDS, CITY_REACTION_KINDS
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

function confirmationCollector(id: string, data: ReactionCollectorCreation["data"]): ReactionCollectorCreation {
	return {
		id,
		endTime: Date.now() + 60_000,
		data,
		reactions: [
			{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
			{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
		]
	};
}

async function chooseFirstCollectorChoice(
	collector: ReactionCollectorCreation,
	choiceText: string,
	onChoose: jest.Mock,
	assertView: () => void
): Promise<void> {
	await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);
	assertView();
	await fireEvent.press(screen.getByText(choiceText));
	expect(onChoose).toHaveBeenCalledWith(0);
}

describe("AdventureCollector", () => {
	it("renders the city menu in the adventure tab and submits its indexed choice", async () => {
		const onChoose = jest.fn();
		const collector: ReactionCollectorCreation = {
			id: "city",
			endTime: Date.now() + 60_000,
			data: {
				type: CITY_DATA_KINDS.CITY,
				data: {mapTypeId: "ci", mapLocationId: 10, availableServices: ["blacksmith"]}
			},
			reactions: [
				{type: CITY_REACTION_KINDS.HOME_MENU, data: {}},
				{type: CITY_REACTION_KINDS.BLACKSMITH_MENU, data: {}},
				{type: CITY_REACTION_KINDS.EXIT, data: {}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		};

		await chooseFirstCollectorChoice(collector, "app:city.actions.home", onChoose, () => {
			expect(screen.getByText("app:city.titles.eyebrow")).toBeTruthy();
			expect(screen.getByText("app:city.titles.housing")).toBeTruthy();
			expect(screen.getByText("app:city.titles.services")).toBeTruthy();
			expect(screen.getByText("app:city.titles.quit")).toBeTruthy();
			expect(screen.queryByText("commands:report.city.reactions.stay.label")).toBeNull();
			expect(screen.queryByText("app:collector.timeLeft")).toBeNull();
		});
	});

	it("uses the Adventure tab composition for a mini-event and submits its indexed choice", async () => {
		const onChoose = jest.fn();
		await chooseFirstCollectorChoice(smallEvent(), "small-event-choice", onChoose, () => {
			expect(screen.getByText("app:adventure.smallEvent.eyebrow")).toBeTruthy();
			expect(screen.getByText("small-event-title")).toBeTruthy();
			expect(screen.getByText("small-event-description")).toBeTruthy();
		});
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
		const collector = confirmationCollector("use-tokens", {
			type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 2, playerTokens: 5}
		});

		await chooseFirstCollectorChoice(collector, "app:adventure.tokens.use.confirm", onChoose, () => {
			expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.tokens.fields.cost")).toBeTruthy();
		});
	});

	it("renders the alteration cure confirmation with the server price", async () => {
		const onChoose = jest.fn();
		const collector = confirmationCollector("buy-heal", {
			type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}
		});

		await chooseFirstCollectorChoice(collector, "app:adventure.heal.use.confirm", onChoose, () => {
			expect(screen.getByText("app:adventure.heal.use.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.heal.fields.cost")).toBeTruthy();
		});
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

		await chooseFirstCollectorChoice(collector, "app:adventure.tokens.merchant.buyOne", onChoose, () => {
			expect(screen.getByText("app:adventure.tokens.merchant.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.tokens.fields.balance")).toBeTruthy();
		});
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
