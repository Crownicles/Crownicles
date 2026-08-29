import {render, screen} from "@testing-library/react-native";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import Adventure from "@/app/(protected)/(tabs)/index";
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
});
