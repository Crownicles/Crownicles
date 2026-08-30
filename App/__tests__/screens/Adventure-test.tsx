import {render, screen} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import Adventure, {reportRefreshDelay} from "@/app/(protected)/(tabs)/index";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useGameQuery} from "@/src/store/useGameQuery";
import {useCollectors} from "@/src/collectors/CollectorsContext";

jest.mock("expo-router", () => ({
	useFocusEffect: (): void => undefined
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
		t: (key: string): string => key
	}
}));

const mockedUseGameQuery = jest.mocked(useGameQuery);
const mockedUsePlayerProfile = jest.mocked(usePlayerProfile);
const mockedUseCollectors = jest.mocked(useCollectors);

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

function profile(): ProfileRes {
	return {health: {value: 75, max: 100}} as ProfileRes;
}

describe("Adventure screen", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		mockedUsePlayerProfile.mockReturnValue({status: "ready", data: profile()});
		mockedUseCollectors.mockReturnValue({open: [], track: jest.fn(), react: jest.fn(), isAnswerPending: jest.fn(() => false)});
	});

	it("matches the travel report composition from the mobile mockup", async () => {
		mockedUseGameQuery.mockReturnValue({status: "ready", data: report()});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.title")).toBeTruthy();
		expect(screen.getByText("models:map_locations.2.name")).toBeTruthy();
		expect(screen.getByText("app:adventure.fields.timeRemaining")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.advance")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.map")).toBeTruthy();
		expect(screen.queryByText("app:adventure.sections.status")).toBeNull();
	});

	it("keeps the travel report visible behind the token confirmation", async () => {
		mockedUseGameQuery.mockReturnValue({status: "ready", data: report()});
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
			isAnswerPending: jest.fn(() => false)
		});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.travel.title")).toBeTruthy();
		expect(screen.getByText("app:adventure.tokens.use.title")).toBeTruthy();
	});

	it("shows the cure action for an alteration while staying in a city", async () => {
		const altered = report();
		altered.effect = "sick";
		altered.effectDuration = 30 * 60_000;
		altered.effectEndTime = Date.now() + altered.effectDuration;
		altered.heal = {price: 410, canAfford: true};
		altered.tokens = undefined;
		altered.isInCity = true;
		mockedUseGameQuery.mockReturnValue({status: "ready", data: altered});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.alteration.eyebrow")).toBeTruthy();
		expect(screen.getByText("app:adventure.quick.heal")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.advance")).toBeNull();
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
		mockedUseGameQuery.mockReturnValue({status: "ready", data: altered});
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
			isAnswerPending: jest.fn(() => false)
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
		mockedUseGameQuery.mockReturnValue({status: "ready", data: occupied});

		await render(<Adventure />);

		expect(screen.getByText("app:adventure.quick.advance")).toBeTruthy();
		expect(screen.queryByText("app:adventure.quick.heal")).toBeNull();
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
			isAnswerPending: jest.fn(() => false)
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

	it("does not schedule another report after arrival", () => {
		const packet = report();
		packet.nextStopTime = 1_700_000_700_000;
		packet.arriveTime = 1_700_000_600_000;

		expect(reportRefreshDelay(packet, 1_700_000_000_000)).toBeNull();
	});
});
