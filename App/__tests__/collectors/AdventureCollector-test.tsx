import type {ReactElement} from "react";
import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS, GENERIC_REACTION_KINDS,
	REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS, CITY_DATA_KINDS, CITY_REACTION_KINDS,
	SHOP_DATA_KINDS, SHOP_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {ReportBigEventResultRes} from "ws-packets/src/fromServer/report/ReportBigEventResultRes";
import {
	SmallEventWitchResultRes, WITCH_OUTCOMES
} from "ws-packets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import {
	AdventureCollector, BigEventOutcome, HealOutcome, LotteryOutcome, TokenOutcome, WitchOutcome
} from "@/src/collectors/AdventureCollector";
import {CityMenu} from "@/src/collectors/CityCollector";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({push: mockPush})}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIconOrNull: (): null => null,
		getIcon: (): string => ""
	}
}));

jest.mock("@/src/collectors/CollectorLabels", () => ({
	collectorDescription: (): string => "small-event-description",
	collectorTitle: (): string => "small-event-title",
	itemDisplayName: (): string => "offered-item",
	isChoosable: (): boolean => true,
	reactionLabel: (reaction: {type: string; data: {name?: string}}): string => reaction.data.name ?? reaction.type
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
	scenario: CollectorScenario,
	onChoose: jest.Mock
): Promise<void> {
	await render(<AdventureCollector collector={scenario.collector()} onChoose={onChoose} submitting={false} />);
	scenario.assertView();
	await fireEvent.press(screen.getByText(scenario.choiceText));
	expect(onChoose).toHaveBeenCalledWith(scenario.expectedIndex ?? 0);
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
	expectedIndex?: number;
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
					guildFoodShop: {
						guildName: "Les tests", playerMoney: 0, treasury: 0,
						food: {common: 0, herbivorous: 0, carnivorous: 0, ultimate: 0},
						foodCaps: [150, 90, 90, 30], foodPrices: [20, 250, 250, 600],
						maxBuyableFood: [0, 0, 0, 0], maxFoodCosts: [0, 0, 0, 0], canUseShop: true
					}
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

function cityHomePurchase(price = 950, canBuy = true): ReactionCollectorCreation {
	const collector = cityCollector();
	if (collector.data.type !== CITY_DATA_KINDS.CITY) throw new Error("Expected a city collector fixture");
	const cityData = collector.data.data;
	collector.data = {
		type: CITY_DATA_KINDS.CITY,
		data: {
			...cityData,
			snapshot: {...cityData.snapshot, home: {manage: {newPrice: price, currentMoney: 2_000, canBuy}}}
		}
	};
	collector.reactions.splice(1, 0, {type: CITY_REACTION_KINDS.BUY_HOME, data: {}});
	return collector;
}

/** A shop selling one item, closed by the reaction right after it. */
function shopCollector(id: string, data: {availableCurrency: number; shopId?: string}, item: {shopItemId: number; shopCategoryId: string}): ReactionCollectorCreation {
	return {
		id,
		endTime: Date.now() + 60_000,
		data: {type: SHOP_DATA_KINDS.COLLECTOR, data: {currency: "gem", ...data}},
		reactions: [
			{type: SHOP_REACTION_KINDS.ITEM, data: {...item, amount: 1, price: 3}},
			{type: SHOP_REACTION_KINDS.CLOSE, data: {}}
		]
	};
}

const VETERINARIAN_TREATMENT = {shopItemId: 14, shopCategoryId: "services"};

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
		choiceText: SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
		assertView: () => {
			expect(screen.getByText("app:adventure.smallEvent.eyebrow")).toBeTruthy();
			expect(screen.getByText("small-event-title")).toBeTruthy();
			expect(screen.getByText("small-event-description")).toBeTruthy();
		}
	},
	{
		name: "renders the PVE island invitation with its cost and energy",
		collector: () => confirmationCollector("pve-island", {
			type: SMALL_EVENT_DATA_KINDS.PVE_ISLAND,
			data: {price: 0, energy: {current: 80, max: 100}}
		}),
		choiceText: GENERIC_REACTION_KINDS.ACCEPT,
		assertView: () => {
			expect(screen.getByText("app:collector.pveIsland.title")).toBeTruthy();
			expect(screen.getByText("app:collector.pveIsland.energy")).toBeTruthy();
			expect(screen.getByText("app:collector.pveIsland.crossing")).toBeTruthy();
			expect(screen.getByText("app:collector.pveIsland.free")).toBeTruthy();
			expect(screen.getByText("app:collector.pveIsland.warning")).toBeTruthy();
		}
	},
	{
		name: "hides the server-only end possibility without shifting big-event indexes",
		collector: () => ({
			id: "big-event",
			endTime: Date.now() + 60_000,
			data: {type: BIG_EVENT_DATA_KINDS.COLLECTOR, data: {eventId: 18}},
			reactions: [
				{type: BIG_EVENT_REACTION_KINDS.POSSIBILITY, data: {name: "end"}},
				{type: BIG_EVENT_REACTION_KINDS.POSSIBILITY, data: {name: "search"}}
			]
		}),
		choiceText: "search",
		expectedIndex: 1,
		assertView: () => {
			expect(screen.queryByText("end")).toBeNull();
		}
	},
	{
		name: "shows the item and price offered by a travelling merchant",
		collector: () => confirmationCollector("small-event-shop", {
			type: SMALL_EVENT_DATA_KINDS.SHOP,
			data: {
				item: {
					id: 7,
					rarity: 1,
					itemCategory: 0,
					itemLevel: 2,
					attack: {baseValue: 1, upgradeValue: 2, maxValue: 3},
					defense: {baseValue: 1, upgradeValue: 2, maxValue: 3},
					speed: {baseValue: 1, upgradeValue: 2, maxValue: 3}
				},
				price: 200
			}
		}),
		choiceText: "app:city.shop.buy",
		assertView: () => {
			expect(screen.getByText("app:collector.shop.fields.rarity")).toBeTruthy();
			expect(screen.getByText("app:collector.shop.fields.price")).toBeTruthy();
		}
	},
	{
		name: "shows the recipe and price offered during travel",
		collector: () => confirmationCollector("recipe-shop", {
			type: SMALL_EVENT_DATA_KINDS.RECIPE_SHOP,
			data: {
				source: "farmer",
				recipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"},
				recipeCost: 300
			}
		}),
		choiceText: "app:city.shop.buy",
		assertView: () => {
			expect(screen.getByText("models:cooking.recipeDisplay")).toBeTruthy();
			expect(screen.getByText("app:collector.recipeShop.fields.price")).toBeTruthy();
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
			expect(screen.getByText("app:adventure.tokens.use.description")).toBeTruthy();
			expect(screen.queryByText("app:adventure.tokens.fields.currentBalance")).toBeNull();
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
		name: "shows the consequence and discovered recipe after a witch choice",
		renderOutcome: onContinue => <WitchOutcome
			outcome={{
				ingredientId: "greenApple",
				isIngredient: true,
				forceEffect: true,
				effectId: "sick",
				timeLostMinutes: 15,
				lifeLoss: 10,
				outcome: WITCH_OUTCOMES.POTION,
				discoveredRecipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"}
			} as SmallEventWitchResultRes}
			onContinue={onContinue}
		/>,
		continueText: "app:adventure.smallEvent.continue",
		assertView: () => {
			expect(screen.getByText("app:adventure.witch.resultTitle")).toBeTruthy();
			expect(screen.getByText("app:adventure.witch.outcomes.potion")).toBeTruthy();
			expect(screen.getByText("app:adventure.witch.fields.effect")).toBeTruthy();
			expect(screen.getByText("app:adventure.witch.fields.recipe")).toBeTruthy();
			expect(screen.getByText("app:adventure.event.fields.timeLost")).toBeTruthy();
		}
	},
	{
		name: "shows a big-event outcome before the player continues",
		renderOutcome: onContinue => <BigEventOutcome outcome={bigEventOutcome()} onContinue={onContinue} />,
		continueText: "app:adventure.event.continue",
		assertView: () => {
			expect(screen.getByText("events:19.possibilities.cook.outcomes.success")).toBeTruthy();
			expect(screen.getByText("events:19.possibilities.cook.text")).toBeTruthy();
			expect(screen.getByText("app:adventure.event.fields.money")).toBeTruthy();
			expect(screen.getByText("+20")).toBeTruthy();
			expect(screen.getByText("app:adventure.event.fields.timeLost")).toBeTruthy();
		}
	},
	{
		name: "shows a token purchase result before returning to the journey",
		renderOutcome: onContinue => <TokenOutcome outcome={{kind: "bought", packet: {amount: 5}}} onContinue={onContinue} />,
		continueText: "app:adventure.tokens.continue",
		assertView: () => {
			expect(screen.getAllByText("app:adventure.tokens.outcomes.bought")).toHaveLength(1);
			expect(screen.getByText("app:adventure.tokens.fields.received")).toBeTruthy();
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
	}
];

describe("AdventureCollector", () => {
	it.each(collectorScenarios)("$name", async scenario => {
		await chooseFirstCollectorChoice(scenario, jest.fn());
	});

	it("confirms a token bundle before buying it", async () => {
		const onChoose = jest.fn();
		await render(<AdventureCollector collector={merchantCollector()} onChoose={onChoose} submitting={false} />);

		expect(screen.getByText("app:adventure.tokens.merchant.title")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.tokens.merchant.buyOne"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("app:adventure.tokens.fields.remainingMoney")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:adventure.tokens.merchant.confirm"));
		expect(onChoose).toHaveBeenCalledWith(0);
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

	it.each([
		["commands:report.city.homes.chest.menuLabel", "chest"],
		["app:city.labels.cooking", "cooking"]
	])("opens %s independently of the expiring city collector", async (label, service) => {
		mockPush.mockClear();
		const onChoose = jest.fn();
		const collector = cityCollector();
		if (collector.data.type !== CITY_DATA_KINDS.CITY) throw new Error("Expected city fixture");
		const home = collector.data.data.snapshot?.home?.owned;
		if (!home) throw new Error("Expected home fixture");
		home.hasChest = true;
		home.hasCooking = true;
		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);
		await fireEvent.press(screen.getByText("app:city.labels.home"));
		await fireEvent.press(screen.getByText(label));
		expect(mockPush).toHaveBeenCalledWith({pathname: "/home/[service]", params: {service}});
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("confirms a paid city action inside its own row", async () => {
		const onChoose = jest.fn();
		const collector = cityHomePurchase();
		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByText("app:city.actions.notary"));
		await fireEvent.press(screen.getByText(CITY_REACTION_KINDS.BUY_HOME));
		expect(onChoose).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("submits the offer the unfolded row is showing after a refresh", async () => {
		const staleChoice = jest.fn();
		const refreshedChoice = jest.fn();
		await render(<CityMenu collector={cityHomePurchase()} onChoose={staleChoice} submitting={false} />);
		await fireEvent.press(screen.getByText("app:city.actions.notary"));
		await fireEvent.press(screen.getByText(CITY_REACTION_KINDS.BUY_HOME));
		await screen.rerender(<CityMenu collector={cityHomePurchase(1_500)} onChoose={refreshedChoice} submitting={false} />);
		await fireEvent.press(screen.getByText("app:collector.accept"));
		expect(refreshedChoice).toHaveBeenCalledWith(1);
		expect(staleChoice).not.toHaveBeenCalled();
	});

	it("says on the row why an unaffordable home cannot be bought", async () => {
		const onChoose = jest.fn();
		const collector = cityHomePurchase(5_000, false);
		await render(<CityMenu collector={collector} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByText("app:city.actions.notary"));
		expect(screen.getByText("app:city.locks.missingMoney")).toBeTruthy();

		await fireEvent.press(screen.getByText(CITY_REACTION_KINDS.BUY_HOME));
		expect(onChoose).not.toHaveBeenCalled();
	});

	it("titles a commerce after itself and says what the purchase does", async () => {
		const collector = shopCollector("veterinarian", {availableCurrency: 51, shopId: "veterinarian"}, VETERINARIAN_TREATMENT);
		await render(<AdventureCollector collector={collector} onChoose={jest.fn()} submitting={false} />);

		expect(screen.getByText("commands:report.city.shops.veterinarian.label")).toBeTruthy();
		expect(screen.queryByText("app:city.shop.title")).toBeNull();
		expect(screen.getByText("commands:shop.shopItems.lovePointsValue.info")).toBeTruthy();
		expect(screen.getByText("app:city.shop.buy")).toBeTruthy();
	});

	it("leaves a commerce through the back chevron", async () => {
		const onChoose = jest.fn();
		const collector = shopCollector("leaving-shop", {availableCurrency: 51, shopId: "veterinarian"}, VETERINARIAN_TREATMENT);
		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByLabelText("app:city.shop.close"));
		expect(onChoose).toHaveBeenCalledWith(1);
	});

	it("does not submit a shop item which costs more than the available currency", async () => {
		const onChoose = jest.fn();
		const collector = shopCollector("unaffordable-shop", {availableCurrency: 2}, {shopItemId: 4, shopCategoryId: "slots"});
		await render(<AdventureCollector collector={collector} onChoose={onChoose} submitting={false} />);

		await fireEvent.press(screen.getByText("app:city.shop.buy"));
		expect(onChoose).not.toHaveBeenCalled();
		expect(screen.getByText("app:city.locks.missingMoney")).toBeTruthy();
	});

	it.each(outcomeScenarios)("$name", async scenario => {
		await continueOutcome(scenario.renderOutcome, scenario.continueText, scenario.assertView);
	});
});
