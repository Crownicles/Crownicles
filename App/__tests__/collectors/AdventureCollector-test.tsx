import type {ReactElement} from "react";
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
		getIconOrNull: (): null => null,
		getIcon: (): string => ""
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

async function continueOutcome(
	renderOutcome: (onContinue: jest.Mock) => ReactElement,
	continueText: string,
	assertView: () => void
): Promise<void> {
	const onContinue = jest.fn();
	await render(renderOutcome(onContinue));
	assertView();
	await fireEvent.press(screen.getByText(continueText));
	expect(onContinue).toHaveBeenCalledTimes(1);
}

type CollectorScenario = {
	name: string;
	collector: () => ReactionCollectorCreation;
	choiceText: string;
	assertView: () => void;
};

function cityCollector(): ReactionCollectorCreation {
	return {
		id: "city",
		endTime: Date.now() + 60_000,
		data: {
			type: CITY_DATA_KINDS.CITY,
			data: {
				mapTypeId: "ci",
				mapLocationId: 10,
				availableServices: ["blacksmith", "bossArchivist"],
				snapshot: {
					home: {
					owned: {
						level: 3,
						bedHealthRegeneration: 12,
						gardenPlots: 0,
						hasBed: true,
						hasChest: false,
						hasGarden: false,
						hasCooking: false,
						hasUpgradeStation: false,
						upgradeableItemCount: 0
					}
				},
					shops: [{shopId: "generalShop", isEmpty: true}],
					guildFoodShop: {guildName: "Les tests", playerMoney: 0, treasury: 0}
				}
			}
		},
		reactions: [
			{type: CITY_REACTION_KINDS.EXIT, data: {}},
			{type: CITY_REACTION_KINDS.HOME_MENU, data: {}},
			{type: CITY_REACTION_KINDS.BLACKSMITH_MENU, data: {}},
			{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
		]
	};
}

function merchantCollector(): ReactionCollectorCreation {
	return {
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
}

const collectorScenarios: CollectorScenario[] = [
	{
		name: "renders the city menu in the adventure tab and submits its indexed choice",
		collector: cityCollector,
		choiceText: "commands:report.city.reactions.exit.label",
		assertView: () => {
			expect(screen.getByText("app:city.titles.eyebrow")).toBeTruthy();
			expect(screen.getByText("app:city.titles.housing")).toBeTruthy();
			expect(screen.getByText("app:city.titles.services")).toBeTruthy();
			expect(screen.getByText("commands:report.city.bossArchivist.serviceTitle")).toBeTruthy();
			expect(screen.getByText("commands:report.city.shops.generalShop.label")).toBeTruthy();
			expect(screen.getByText("commands:report.city.shopEmptyDescription")).toBeTruthy();
			expect(screen.getByText("commands:report.city.guildFoodShop.label")).toBeTruthy();
			expect(screen.getByText("app:city.titles.quit")).toBeTruthy();
			expect(screen.queryByText("commands:report.city.reactions.stay.label")).toBeNull();
			expect(screen.queryByText("app:collector.timeLeft")).toBeNull();
		}
	},
	{
		name: "uses the Adventure tab composition for a mini-event and submits its indexed choice",
		collector: smallEvent,
		choiceText: "small-event-choice",
		assertView: () => {
			expect(screen.getByText("app:adventure.smallEvent.eyebrow")).toBeTruthy();
			expect(screen.getByText("small-event-title")).toBeTruthy();
			expect(screen.getByText("small-event-description")).toBeTruthy();
		}
	},
	{
		name: "renders the confirmation before spending travel tokens",
		collector: () => confirmationCollector("use-tokens", {
			type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 2, playerTokens: 5}
		}),
		choiceText: "app:adventure.tokens.use.confirm",
		assertView: () => {
			expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.tokens.fields.cost")).toBeTruthy();
		}
	},
	{
		name: "renders the alteration cure confirmation with the server price",
		collector: () => confirmationCollector("buy-heal", {
			type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}
		}),
		choiceText: "app:adventure.heal.use.confirm",
		assertView: () => {
			expect(screen.getByText("app:adventure.heal.use.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.heal.fields.cost")).toBeTruthy();
		}
	},
	{
		name: "uses the merchant's server-provided bundles and limits",
		collector: merchantCollector,
		choiceText: "app:adventure.tokens.merchant.buyOne",
		assertView: () => {
			expect(screen.getByText("app:adventure.tokens.merchant.title")).toBeTruthy();
			expect(screen.getByText("app:adventure.tokens.fields.balance")).toBeTruthy();
		}
	}
];

type OutcomeScenario = {
	name: string;
	renderOutcome: (onContinue: jest.Mock) => ReactElement;
	continueText: string;
	assertView: () => void;
};

const outcomeScenarios: OutcomeScenario[] = [
	{
		name: "shows a big-event outcome before the player continues",
		renderOutcome: onContinue => <BigEventOutcome outcome={bigEventOutcome()} onContinue={onContinue} />,
		continueText: "app:adventure.event.continue",
		assertView: () => {
			expect(screen.getByText("events:19.possibilities.cook.outcomes.success")).toBeTruthy();
			expect(screen.getByText("app:adventure.event.fields.money")).toBeTruthy();
			expect(screen.getByText("+20")).toBeTruthy();
			expect(screen.getByText("app:adventure.event.fields.timeLost")).toBeTruthy();
		}
	},
	{
		name: "shows the token result before returning to the journey",
		renderOutcome: onContinue => <TokenOutcome outcome={{kind: "used", packet: {tokensSpent: 2, isArrived: true}}} onContinue={onContinue} />,
		continueText: "app:adventure.tokens.continue",
		assertView: () => {
			expect(screen.getAllByText("app:adventure.tokens.outcomes.used")).toHaveLength(1);
			expect(screen.getByText("app:adventure.tokens.fields.spent")).toBeTruthy();
		}
	},
	{
		name: "shows the cure result before returning to the journey",
		renderOutcome: onContinue => <HealOutcome outcome={{kind: "accepted", packet: {healPrice: 410, isArrived: false}}} onContinue={onContinue} />,
		continueText: "app:adventure.heal.continue",
		assertView: () => {
			expect(screen.getByText("app:adventure.heal.outcomes.accepted")).toBeTruthy();
			expect(screen.getByText("app:adventure.heal.fields.spent")).toBeTruthy();
		}
	},
	{
		name: "shows the reward and the lost time sent by the lottery",
		renderOutcome: onContinue => <LotteryOutcome
			outcome={{
				kind: "win",
				packet: {lostTime: 15 * 60_000, winAmount: 40, winReward: "money", level: "medium"}
			}}
			onContinue={onContinue}
		/>,
		continueText: "app:adventure.smallEvent.continue",
		assertView: () => {
			expect(screen.getByText("app:adventure.lottery.resultTitle")).toBeTruthy();
			expect(screen.getByText("app:adventure.lottery.win")).toBeTruthy();
			expect(screen.getByText("app:adventure.lottery.rewards.money")).toBeTruthy();
			expect(screen.getByText("+40")).toBeTruthy();
		}
	},
	{
		name: "shows a generic result for an altar resolution",
		renderOutcome: onContinue => <SmallEventOutcome
			outcome={{
				eventName: "SmallEventAltarContributedPacket",
				data: {amount: 130, blessingTriggered: false}
			}}
			onContinue={onContinue}
		/>,
		continueText: "app:adventure.smallEvent.continue",
		assertView: () => {
			expect(screen.getByText("app:adventure.smallEvent.resultTitle")).toBeTruthy();
			expect(screen.getByText("Amount")).toBeTruthy();
			expect(screen.getByText("130")).toBeTruthy();
		}
	}
];

describe("AdventureCollector", () => {
	it.each(collectorScenarios)("$name", async scenario => {
		await chooseFirstCollectorChoice(scenario.collector(), scenario.choiceText, jest.fn(), scenario.assertView);
	});

	it("opens a city top-level menu locally before submitting a nested action", async () => {
		const onChoose = jest.fn();
		const collector = cityCollector();
		collector.reactions.splice(2, 0, {type: CITY_REACTION_KINDS.HOME_BED, data: {}});
		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByText("app:city.labels.home"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("app:city.titles.homeServices")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:city.labels.bed"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("app:city.titles.actions")).toBeTruthy();

		await fireEvent.press(screen.getByText("commands:report.city.homes.bed.buttonLabel"));
		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it.each(outcomeScenarios)("$name", async scenario => {
		await continueOutcome(scenario.renderOutcome, scenario.continueText, scenario.assertView);
	});
});
