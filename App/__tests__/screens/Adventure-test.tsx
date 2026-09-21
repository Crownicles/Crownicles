import {fireEvent, render, screen} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import Adventure, {reportRefreshDelay, tokenOutcomeNeedsAcknowledgement} from "@/app/(protected)/(tabs)/index";
import {ReportCityActionRes, ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportCityActionReq, ReportViewReq} from "ws-packets/src/fromClient/ReportViewReq";
import {REPORT_CITY_ACTION_RESULTS} from "ws-packets/src/objects/ReportView";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameClient} from "@/src/networking/GameClient";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS, GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCollectors} from "@/src/collectors/CollectorsContext";

jest.mock("expo-router", () => ({
	useFocusEffect: (): void => undefined,
	useRouter: (): {push: jest.Mock} => ({push: jest.fn()})
}));

jest.mock("@/src/store/useGameQuery", () => ({
	useGameQuery: jest.fn()
}));

jest.mock("@/src/store/usePlayerProfile", () => ({
	usePlayerProfile: jest.fn()
}));

jest.mock("@/src/collectors/CollectorsContext", () => ({
	useCollectors: jest.fn()
}));

jest.mock("@tanstack/react-query", () => ({
	useQueryClient: (): {invalidateQueries: jest.Mock} => ({invalidateQueries: jest.fn(() => Promise.resolve())})
}));

jest.mock("@/src/AppIcons", () => ({
	AppIcons: {
		getIcon: (path: string): string => `icon:${path}`,
		getIconOrNull: jest.fn(() => null)
	}
}));

jest.mock("@/src/translations/i18n", () => ({
	i18n: {
		t: (key: string): string => key,
		tArray: (key: string): string[] => [`${key}:only`]
	}
}));

const mockedUseGameQuery = jest.mocked(useGameQuery);
const mockedUsePlayerProfile = jest.mocked(usePlayerProfile);
const mockedUseCollectors = jest.mocked(useCollectors);
const mockedAppIcons = jest.mocked(AppIcons);

function report(showEnergy = false): ReportTravelSummaryRes {
	return {
		startMap: {id: 1, type: "main"},
		endMap: {id: 2, type: "main"},
		startTime: Date.now() - 60_000,
		arriveTime: Date.now() + 3_600_000,
		nextStopTime: Date.now() + 600_000,
		isOnBoat: false,
		points: {show: true, cumulated: 42},
		energy: {show: showEnergy, current: 8, max: 10},
		tokens: {cost: 1, canAfford: true},
		isInCity: false
	};
}

function mockReport(travel = report(), reportReady = false): ReportViewRes {
	const view = Object.assign(new ReportViewRes(), {travel, reportReady});
	mockedUseGameQuery.mockReturnValue({status: "ready", data: view});
	return view;
}

function mockCity(): ReportViewRes {
	const view = mockReport({...report(), isInCity: true});
	view.city = {
		data: {type: CITY_DATA_KINDS.CITY, data: {mapLocationId: 10, mapTypeId: "ci", availableServices: []}},
		actions: [{id: "a".repeat(64), reaction: {type: CITY_REACTION_KINDS.EXIT, data: {}}}]
	};
	return view;
}

function profile(): ProfileRes {
	return {
		health: {value: 75, max: 100},
		stats: {
			energy: {value: 8, max: 10},
			attack: 12,
			defense: 9,
			speed: 7,
			breath: {base: 3, max: 8, regen: 1}
		},
		missions: {gems: 3, campaignProgression: 4},
		money: 1_240,
		tokens: {value: 2, max: 5}
	} as ProfileRes;
}

describe("Adventure screen", () => {
	afterEach(() => jest.restoreAllMocks());
	beforeEach((): void => {
		jest.clearAllMocks();
		mockedUsePlayerProfile.mockReturnValue({status: "ready", data: profile()});
		mockedUseCollectors.mockReturnValue({open: [], track: jest.fn(), react: jest.fn(), isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()});
	});

	it("matches the travel report composition from the mobile mockup", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.fields.timeRemaining")).toBeTruthy();
		expect(screen.getByText("app:adventure.fields.nextStop")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.advanceWithCost")).toBeTruthy();
		expect(screen.queryByText("app:adventure.sections.status")).toBeNull();
	});

	it("waits for an explicit action before starting the first journey", async () => {
		mockedUseGameQuery.mockReturnValue({status: "ready", data: Object.assign(new ReportViewRes(), {reportReady: true})});
		const request = jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "alternative", packetName: SmallEventResultRes.wireName});
		await render(<Adventure />);
		expect(screen.getByText("app:adventure.startReport")).toBeTruthy();
		expect(request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", {name: "app:adventure.continueReport"}));
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportReq);
	});

	it("shows a passive city and sends a city action only when the player chooses to leave", async () => {
		mockCity();
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet: Object.assign(new ReportCityActionRes(), {result: REPORT_CITY_ACTION_RESULTS.EXECUTED})});
		await render(<Adventure />);
		expect(screen.getByText("app:city.titles.eyebrow")).toBeTruthy();
		expect(request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("commands:report.city.reactions.exit.label"));
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportCityActionReq);
		expect(request.mock.calls[0][0]).toMatchObject({mapLocationId: 10, actionId: "a".repeat(64)});
		expect(mockedUseCollectors.mock.results[0].value.track).not.toHaveBeenCalled();
	});

	it("keeps a recovered token confirmation visible above the passive city", async () => {
		mockCity();
		const react = jest.fn();
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "city-token-confirmation",
				endTime: Date.now() + 60_000,
				data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 1, playerTokens: 5}},
				reactions: [{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]
			}],
			track: jest.fn(), react, isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});
		await render(<Adventure />);
		expect(screen.getByText("app:city.titles.eyebrow")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.tokens.use.confirm"));
		expect(react).toHaveBeenCalledWith("city-token-confirmation", 0);
	});

	it("closes the travel report with an advice, like the Discord report does", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("advices:advices:only")).toBeTruthy();
	});

	it("names the last mini-event in the title, like the Discord report does", async () => {
		const afterSmallEvent = report();
		afterSmallEvent.lastSmallEventId = "lottery";
		mockReport(afterSmallEvent);
		mockedAppIcons.getIconOrNull.mockImplementation((path: string) => (path === "smallEvents.lottery" ? "icon:lottery" : null));

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.titleWithLastEvent")).toBeTruthy();
		expect(screen.queryByText("app:adventure.travel.title")).toBeNull();
	});

	it("announces the arrival instead of a next stop once the journey has none left", async () => {
		const arriving = report();
		arriving.nextStopTime = arriving.arriveTime + 60_000;
		mockReport(arriving);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.subtitleArrivingSoon")).toBeTruthy();
		expect(screen.queryByText("app:adventure.travel.subtitle")).toBeNull();
	});

	it("offers to buy tokens instead of advancing when the player cannot afford it", async () => {
		const poor = report();
		poor.tokens = {cost: 3, canAfford: false};
		poor.heal = {price: 410, canAfford: false};
		mockReport(poor);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.quick.getTokens")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.healNotEnough")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.advanceWithCost")).toBeNull();
	});

	it("refuses to spend a token when the report is already waiting to be read", async () => {
		const request = jest.spyOn(GameClient, "request");
		mockReport(report(), true);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.quick.advanceUseless")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:adventure.quick.advanceWithCost"));
		expect(request).not.toHaveBeenCalled();
	});

	it("keeps the vitals band above the report like the mobile mockup", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("75 / 100")).toBeTruthy();
		expect(screen.getByText("8 / 10")).toBeTruthy();
		expect(screen.getByText("icon:unitValues.money 1,240")).toBeTruthy();
		expect(screen.getByText("icon:unitValues.gem 3")).toBeTruthy();
		expect(screen.getByText("icon:unitValues.token 2")).toBeTruthy();
	});

	it("keeps the travel report visible behind the token confirmation", async () => {
		mockReport();
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "use-tokens",
				endTime: Date.now() + 60_000,
				data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 2, playerTokens: 5}},
				reactions: [
					{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
					{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
				]
			}],
			track: jest.fn(),
			react: jest.fn(),
			isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
	});

	it("keeps a recovered token confirmation actionable when Core blocks the report", async () => {
		mockedUseGameQuery.mockReturnValue({status: "empty", packetName: "Blocked"});
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "recovered-use-tokens",
				endTime: Date.now() + 60_000,
				data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 1, playerTokens: 5}},
				reactions: [
					{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
					{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
				]
			}],
			track: jest.fn(),
			react: jest.fn(),
			isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.tokens.use.confirm")).toBeTruthy();
	});

	it("routes a PVE island invitation into the Adventure screen", async () => {
		mockedUseGameQuery.mockReturnValue({status: "empty", packetName: "Blocked"});
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "pve-island",
				endTime: Date.now() + 60_000,
				data: {type: SMALL_EVENT_DATA_KINDS.PVE_ISLAND, data: {price: 3, energy: {current: 80, max: 100}}},
				reactions: [
					{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
					{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
				]
			}],
			track: jest.fn(),
			react: jest.fn(),
			isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});

		await render(<Adventure />);

		expect(screen.getByText("app:collector.pveIsland.title")).toBeTruthy();
		expect(screen.queryByText("app:collector.pending")).toBeNull();
	});

	it("shows the cure action for an alteration while staying in a city", async () => {
		const altered = report();
		altered.effect = "sick";
		altered.effectDuration = 30 * 60_000;
		altered.effectEndTime = Date.now() + altered.effectDuration;
		altered.heal = {price: 410, canAfford: true};
		altered.tokens = undefined;
		altered.isInCity = true;
		mockReport(altered);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.alteration.eyebrow")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.heal")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.advanceWithCost")).toBeNull();
		expect(screen.getByText("app:adventure.alteration.fields.timeRemaining")).toBeTruthy();
	});

	it("keeps the alteration report visible behind the cure confirmation", async () => {
		const altered = report();
		altered.effect = "sick";
		altered.effectDuration = 30 * 60_000;
		altered.effectEndTime = Date.now() + altered.effectDuration;
		altered.heal = {price: 410, canAfford: true};
		altered.tokens = undefined;
		altered.isInCity = true;
		mockReport(altered);
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "buy-heal",
				endTime: Date.now() + 60_000,
				data: {type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}},
				reactions: [
					{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
					{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
				]
			}],
			track: jest.fn(),
			react: jest.fn(),
			isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.alteration.eyebrow")).toBeTruthy();
		expect(screen.getByText("app:adventure.heal.use.title")).toBeTruthy();
	});

	it("keeps token advance as the remedy for an occupied alteration", async () => {
		const occupied = report();
		occupied.effect = "occupied";
		occupied.effectDuration = 30 * 60_000;
		occupied.effectEndTime = Date.now() + occupied.effectDuration;
		occupied.heal = undefined;
		occupied.isInCity = true;
		mockReport(occupied);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.quick.advanceWithCost")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.heal")).toBeNull();
	});

	it("resumes automatically after advancing, cancelling, or leaving the token merchant", () => {
		expect(tokenOutcomeNeedsAcknowledgement({kind: "used", packet: {tokensSpent: 1, isArrived: false}})).toBe(false);
		expect(tokenOutcomeNeedsAcknowledgement({kind: "useRefused", packet: {}})).toBe(false);
		expect(tokenOutcomeNeedsAcknowledgement({kind: "merchantRefused", packet: {}})).toBe(false);
		expect(tokenOutcomeNeedsAcknowledgement({kind: "bought", packet: {amount: 5}})).toBe(true);
	});

	it("only reads adventure state when mounting or refreshing the query", async () => {
		const view = mockReport();
		const request = jest.spyOn(GameClient, "request").mockResolvedValue({kind: "answer", packet: view});
		await render(<Adventure />);
		expect(request).not.toHaveBeenCalled();
		const query = mockedUseGameQuery.mock.calls.find(([entity]) => entity === GAME_ENTITIES.REPORT)![1];
		await query();
		await query();
		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls.every(([packet]) => packet instanceof ReportViewReq)).toBe(true);
	});

	it("executes the report only after a click and does not replay an automatic small event", async () => {
		mockReport(report(), true);
		const request = jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "alternative", packetName: SmallEventResultRes.wireName});
		await render(<Adventure />);
		expect(request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", {name: "app:adventure.continueReport"}));
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportReq);
	});

	it("renders a readable loading state", async () => {
		mockedUseGameQuery.mockReturnValue({status: "loading"});

		await render(<Adventure />);

		expect(screen.getByText("app:common.loading")).toBeTruthy();
	});

	it("renders a pending action instead of an endless spinner", async () => {
		mockedUseGameQuery.mockReturnValue({status: "loading"});
		mockedUseCollectors.mockReturnValue({
			open: [{
				id: "collector-1",
				endTime: Date.now() + 60_000,
				data: {type: "unknown", data: {serverType: "test"}},
				reactions: []
			}],
			track: jest.fn(),
			react: jest.fn(),
			isAnswerPending: jest.fn(() => false), answerWithoutShowing: jest.fn()
		});

		await render(<Adventure />);

		expect(screen.getByText("app:collector.pending")).toBeTruthy();
	});

	it("renders an error state instead of a blank screen", async () => {
		mockedUseGameQuery.mockReturnValue({status: "failed"});

		await render(<Adventure />);

		expect(screen.getByText("app:common.error")).toBeTruthy();
	});

	it("renders the empty state returned by the data layer", async () => {
		mockedUseGameQuery.mockReturnValue({status: "empty", packetName: "ReportUnavailable"});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.empty")).toBeTruthy();
	});

	it("schedules the next report when the journey has another stop", () => {
		const packet = report();
		packet.nextStopTime = 1_700_000_300_000;
		packet.arriveTime = 1_700_000_600_000;

		expect(reportRefreshDelay(packet, 1_700_000_000_000)).toBe(300_000);
	});

	it("refreshes the read-only view at arrival but never loops on an already-due report", () => {
		const packet = report();
		packet.nextStopTime = 1_700_000_700_000;
		packet.arriveTime = 1_700_000_600_000;

		expect(reportRefreshDelay(packet, 1_700_000_000_000)).toBe(600_000);
		expect(reportRefreshDelay(packet, packet.arriveTime)).toBeNull();
		packet.isInCity = true;
		expect(reportRefreshDelay(packet, 1_700_000_000_000)).toBeNull();
	});
});
