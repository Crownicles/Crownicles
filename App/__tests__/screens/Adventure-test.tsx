import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {SmallEventResultRes} from "ws-packets/src/fromServer/smallEvents/SmallEventResultRes";
import Adventure, {reportRefreshDelay, reportWait, tokenOutcomeNeedsAcknowledgement} from "@/app/(protected)/(tabs)/index";
import {ReportCityActionRes, ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {ReportCityActionReq, ReportViewReq} from "ws-packets/src/fromClient/ReportViewReq";
import {REPORT_CITY_ACTION_RESULTS} from "ws-packets/src/objects/ReportView";
import {ReportReq} from "ws-packets/src/fromClient/ReportReq";
import {ReportUseTokensReq} from "ws-packets/src/fromClient/ReportUseTokensReq";
import {ReportBuyHealReq} from "ws-packets/src/fromClient/ReportBuyHealReq";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {GameClient} from "@/src/networking/GameClient";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS, GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, SMALL_EVENT_DATA_KINDS
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {reportEventStore} from "@/src/collectors/ReportEventStore";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {ReportUseTokensAcceptedRes} from "ws-packets/src/fromServer/report/ReportTokenRes";
import {ReportBuyHealAcceptedRes} from "ws-packets/src/fromServer/report/ReportHealRes";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {useMissions} from "@/src/components/Missions";
import {i18n} from "@/src/translations/i18n";

/** Delivers a packet exactly as Core pushes it through the socket. */
function pushFromCore(wireName: string, packet: object): void {
	Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(wireName, packet);
}

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

jest.mock("@/src/components/Missions", () => ({
	useMissions: jest.fn((): object => ({status: "loading"})),
	Missions: (): null => null
}));

jest.mock("expo-secure-store", () => ({getItem: (): null => null, setItem: jest.fn()}));

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
		tArray: jest.fn((key: string): string[] => [`${key}:only`])
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
		level: 12,
		experience: {value: 100, max: 900},
		pseudo: "Aster",
		money: 1_240,
		tokens: {value: 2, max: 5}
	} as ProfileRes;
}

describe("Adventure screen", () => {
	afterEach(() => jest.restoreAllMocks());
	beforeEach((): void => {
		jest.clearAllMocks();
		jest.mocked(i18n.tArray).mockImplementation((key: string): string[] => [`${key}:only`]);
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

	it("advances in a single tap: the token confirmation is answered without being shown", async () => {
		mockReport();
		const confirmation: ReactionCollectorCreation = {
			id: "use-tokens",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 1, playerTokens: 5}},
			reactions: [{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}, {type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}]
		};
		const request = jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "answer", packet: confirmation});

		await render(<Adventure />);
		await fireEvent.press(screen.getByText("app:adventure.quick.advanceWithCost"));

		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportUseTokensReq);
		const collectors = mockedUseCollectors.mock.results[0].value;
		expect(collectors.answerWithoutShowing).toHaveBeenCalledWith("use-tokens", 1);
		expect(collectors.track).not.toHaveBeenCalled();
		expect(screen.queryByText("app:adventure.tokens.use.title")).toBeNull();
	});

	it("dashes to the stop reached with the tokens, then opens it, instead of leaving the tile silent", async () => {
		mockReport();
		const confirmation: ReactionCollectorCreation = {
			id: "use-tokens",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 1, playerTokens: 5}},
			reactions: [{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]
		};
		const request = jest.spyOn(GameClient, "request")
			.mockResolvedValueOnce({kind: "answer", packet: confirmation})
			.mockResolvedValueOnce({kind: "alternative", packetName: SmallEventResultRes.wireName});

		await render(<Adventure />);
		await fireEvent.press(screen.getByText("app:adventure.quick.advanceWithCost"));
		expect(request).toHaveBeenCalledTimes(1);

		await act(async () => pushFromCore(ReportUseTokensAcceptedRes.wireName, {tokensSpent: 1, isArrived: false}));
		expect(request).toHaveBeenCalledTimes(1);

		await waitFor(() => expect(request).toHaveBeenCalledTimes(2), {timeout: 3_000});
		expect(request.mock.calls[1][0]).toBeInstanceOf(ReportReq);
		reportEventStore.clearTokens();
	});

	it("welcomes the character who has not set off, and waits for them to leave", async () => {
		mockedUseGameQuery.mockReturnValue({status: "ready", data: Object.assign(new ReportViewRes(), {reportReady: true})});
		const request = jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "alternative", packetName: SmallEventResultRes.wireName});
		await render(<Adventure />);
		expect(screen.getByText("app:welcome.title")).toBeTruthy();
		expect(request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:welcome.depart"));
		await waitFor(() => expect(request).toHaveBeenCalledTimes(1), {timeout: 4_000});
		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportReq);
	});

	it("keeps a newcomer's screen free of what their next levels will open", async () => {
		mockReport();
		mockedUsePlayerProfile.mockReturnValue({status: "ready", data: {...profile(), level: 5, experience: {value: 40, max: 250}} as ProfileRes});
		await render(<Adventure />);
		expect(screen.queryByText(/app:journey\.features/)).toBeNull();
		expect(screen.queryByText("app:utilities.unlock")).toBeNull();
		expect(screen.getByText("app:profile.titles.missions")).toBeTruthy();
	});

	it("guides a newcomer with the one campaign step to do now", async () => {
		mockReport();
		mockedUsePlayerProfile.mockReturnValue({status: "ready", data: {...profile(), level: 2} as ProfileRes});
		jest.mocked(useMissions).mockReturnValue({status: "ready", data: {
			campaignProgression: 2,
			missions: [{missionId: "commandReport", missionType: MISSION_TYPES.CAMPAIGN, missionVariant: 0, missionObjective: 1, numberDone: 0}]
		} as unknown as MissionsRes});
		await render(<Adventure />);
		expect(screen.getByText("app:journey.title")).toBeTruthy();
		expect(screen.getByText("models:missions.commandReport")).toBeTruthy();
	});

	it("leaves the guide out once every part of the game is open, the missions one tap away", async () => {
		mockReport();
		await render(<Adventure />);
		expect(screen.queryByText("app:journey.title")).toBeNull();
		expect(screen.queryByText("app:utilities.unlock")).toBeNull();
		await fireEvent.press(screen.getByText("app:profile.titles.missions"));
		expect(screen.getAllByText("app:profile.titles.missions").length).toBeGreaterThan(1);
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

	it("does not suggest Discord commands in the travel advice", async () => {
		jest.mocked(i18n.tArray).mockReturnValue(["Utilisez la commande /idea !", "Garder de l'argent de côté est judicieux."]);
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("Garder de l'argent de côté est judicieux.")).toBeTruthy();
		expect(screen.queryByText("Utilisez la commande /idea !")).toBeNull();
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

	it("only names the destination under the travel title", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.heading")).toBeTruthy();
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

	it("says the traveller has arrived instead of counting zero minutes", async () => {
		const arrived = {...report(), startTime: Date.now() - 7_200_000, arriveTime: Date.now() - 60_000, nextStopTime: Date.now() - 60_000};
		mockReport(arrived, true);

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.arrivedTitle")).toBeTruthy();
		expect(screen.getByText("app:adventure.travel.arrivedSubtitle")).toBeTruthy();
		expect(screen.queryByText("app:adventure.fields.timeRemaining")).toBeNull();
		expect(screen.queryByText("app:adventure.fields.nextStop")).toBeNull();
	});

	it("offers only the free report once it is ready, so no token is wasted", async () => {
		mockReport(report(), true);

		await render(<Adventure />);

		expect(screen.queryByText("app:adventure.quick.advanceWithCost")).toBeNull();
		expect(screen.getByRole("button", {name: "app:adventure.continueReport"})).toBeTruthy();
	});

	it("merges the token advance into the single journey action while the report waits", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.quick.advanceWithCost")).toBeTruthy();
		expect(screen.getByText("app:adventure.notReady")).toBeTruthy();
		expect(screen.queryByText("app:adventure.continueReport")).toBeNull();
	});

	it("keeps the vitals band above the report like the mobile mockup", async () => {
		mockReport();

		await render(<Adventure />);

		expect(screen.getByText("75 / 100")).toBeTruthy();
		expect(screen.getByText("8 / 10")).toBeTruthy();
		expect(screen.getByLabelText("icon:unitValues.money")).toBeTruthy();
		expect(screen.getByText("1,240")).toBeTruthy();
		expect(screen.getByLabelText("icon:unitValues.gem")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("2")).toBeTruthy();
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

		expect(screen.getByText(/smallEvents:goToPVEIsland\.stories:only/)).toBeTruthy();
		expect(screen.queryByText("app:collector.pending")).toBeNull();
	});

	it("smiles next to the title when nothing holds the player back", async () => {
		mockReport();
		mockedAppIcons.getIconOrNull.mockImplementation((path: string) => ({"effects.none": "😃", "mapTypes.main": "🌲"})[path] ?? null);

		await render(<Adventure />);

		expect(screen.getByLabelText("😃")).toBeTruthy();
		// Only the two ends of the travel path still show the map type.
		expect(screen.getAllByLabelText("🌲")).toHaveLength(2);
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
		expect(screen.getByText("app:adventure.quick.healWithCost")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.advanceWithCost")).toBeNull();
		expect(screen.getByText("app:adventure.alteration.fields.timeRemaining")).toBeTruthy();
	});

	it("heals in a single tap: the priced confirmation is answered without being shown", async () => {
		const altered = report();
		altered.effect = "sick";
		altered.effectDuration = 30 * 60_000;
		altered.effectEndTime = Date.now() + altered.effectDuration;
		altered.heal = {price: 410, canAfford: true};
		mockReport(altered);
		const confirmation: ReactionCollectorCreation = {
			id: "buy-heal",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}},
			reactions: [{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}, {type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}]
		};
		const request = jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "answer", packet: confirmation});

		await render(<Adventure />);
		await fireEvent.press(screen.getByText("app:adventure.quick.healWithCost"));

		expect(request.mock.calls[0][0]).toBeInstanceOf(ReportBuyHealReq);
		expect(mockedUseCollectors.mock.results[0].value.answerWithoutShowing).toHaveBeenCalledWith("buy-heal", 1);
		expect(screen.queryByText("app:adventure.heal.use.title")).toBeNull();
	});

	it("plays the cure on the emblem before opening the heal result", async () => {
		const altered = report();
		altered.effect = "sick";
		altered.effectDuration = 30 * 60_000;
		altered.effectEndTime = Date.now() + altered.effectDuration;
		altered.heal = {price: 410, canAfford: true};
		mockReport(altered);
		mockedAppIcons.getIconOrNull.mockImplementation((path: string) => ({"effects.sick": "🤢", "effects.healed": "🏥", "effects.none": "😃"})[path] ?? null);
		const confirmation: ReactionCollectorCreation = {
			id: "buy-heal",
			endTime: Date.now() + 60_000,
			data: {type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}},
			reactions: [{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]
		};
		jest.spyOn(GameClient, "request").mockResolvedValueOnce({kind: "answer", packet: confirmation});

		await render(<Adventure />);
		await fireEvent.press(screen.getByText("app:adventure.quick.healWithCost"));
		await act(async () => pushFromCore(ReportBuyHealAcceptedRes.wireName, {healPrice: 410, isArrived: false}));

		expect(screen.getByText("app:adventure.alteration.eyebrow")).toBeTruthy();
		expect(screen.getByLabelText("🤢")).toBeTruthy();
		await waitFor(() => expect(screen.getByLabelText("🏥")).toBeTruthy(), {timeout: 3_000});
		await waitFor(() => expect(screen.getByLabelText("😃")).toBeTruthy(), {timeout: 3_000});
		await waitFor(() => expect(screen.queryByText("app:adventure.alteration.eyebrow")).toBeNull(), {timeout: 3_000});
		reportEventStore.clearHeal();
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
		expect(screen.queryByText("app:adventure.quick.healWithCost")).toBeNull();
	});

	it("waits for the end of the alteration before announcing the next report", () => {
		const now = 1_700_000_000_000;
		const occupied = {...report(), effect: "occupied", isInCity: true, arriveTime: now - 60_000, nextStopTime: now - 60_000, effectEndTime: now + 39 * 60_000};

		expect(reportWait(occupied, now)).toBe("app:adventure.duration.minutes");
		expect(reportWait({...occupied, effect: "none"}, now)).toBe("app:adventure.now");
	});

	it("counts the last minute before the next stop in seconds", () => {
		const now = 1_700_000_000_000;
		const travelling = {...report(), arriveTime: now + 3_600_000};

		expect(reportWait({...travelling, nextStopTime: now + 42_000}, now)).toBe("app:adventure.duration.seconds");
		expect(reportWait({...travelling, nextStopTime: now + 60_000}, now)).toBe("app:adventure.duration.minutes");
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

	it("refreshes when an active alteration stops delaying the report", () => {
		const now = 1_700_000_000_000;
		const packet = report();
		packet.nextStopTime = now + 300_000;
		packet.arriveTime = now + 600_000;
		packet.effect = "occupied";
		packet.effectEndTime = now + 900_000;

		expect(reportRefreshDelay(packet, now)).toBe(900_000);
	});
});
