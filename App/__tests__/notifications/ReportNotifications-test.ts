import * as Notifications from "expo-notifications";
import {ReportTravelSummaryRes} from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {scheduleReportNotification} from "@/src/notifications/ReportNotifications";
import {reportReminder} from "@/src/notifications/useNotifications";

jest.mock("expo-notifications", () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
	setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
	scheduleNotificationAsync: jest.fn(() => Promise.resolve("report-ready")),
	cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
	useLastNotificationResponse: jest.fn(),
	AndroidImportance: {DEFAULT: 3},
	SchedulableTriggerInputTypes: {DATE: "date"}
}));
jest.mock("expo-router", () => ({useRouter: jest.fn(), useFocusEffect: jest.fn()}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

const mocked = jest.mocked(Notifications);

function travel(overrides: Partial<ReportTravelSummaryRes> = {}): ReportTravelSummaryRes {
	return {
		startMap: {id: 1, type: "main"},
		endMap: {id: 2, type: "main"},
		startTime: 0,
		arriveTime: 1_700_000_600_000,
		nextStopTime: 1_700_000_300_000,
		isOnBoat: false,
		points: {show: false, cumulated: 0},
		energy: {show: false, current: 0, max: 0},
		isInCity: false,
		...overrides
	};
}

function view(fields: Partial<ReportViewRes>): ReportViewRes {
	return Object.assign(new ReportViewRes(), {reportReady: false, ...fields});
}

function allowed(granted: boolean): void {
	mocked.getPermissionsAsync.mockResolvedValue({granted, canAskAgain: false} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
}

describe("report notification", () => {
	beforeEach(() => jest.clearAllMocks());

	it("reminds of a report still to wait for, at the moment it opens", () => {
		expect(reportReminder(view({travel: travel()}))).toEqual({readyAt: 1_700_000_300_000, destination: "models:map_locations.2.name"});
	});

	it("has nothing to remind once the report is ready, in a city, or before the first journey", () => {
		expect(reportReminder(view({travel: travel(), reportReady: true}))).toBeNull();
		expect(reportReminder(view({travel: travel(), city: {} as ReportViewRes["city"]}))).toBeNull();
		expect(reportReminder(view({}))).toBeNull();
	});

	it("schedules the notification for when the report opens, leading back to the adventure", async () => {
		allowed(true);
		const readyAt = Date.now() + 60_000;

		scheduleReportNotification(readyAt, "Ville");

		await waitForCalls(mocked.scheduleNotificationAsync);
		expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("report-ready");
		expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
			identifier: "report-ready",
			content: expect.objectContaining({data: {screen: "adventure"}}),
			trigger: expect.objectContaining({date: new Date(readyAt)})
		}));
	});

	it("schedules nothing when the player refused notifications or the report is about to open", async () => {
		allowed(false);
		scheduleReportNotification(Date.now() + 60_000, "Ville");
		scheduleReportNotification(Date.now() + 1_000, "Ville");

		await waitForCalls(mocked.cancelScheduledNotificationAsync, 2);
		expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
	});
});

/** Scheduling runs in a queue: wait until the mocked step has run. */
async function waitForCalls(mock: jest.Mock | jest.MockedFunction<(...args: never[]) => unknown>, count = 1): Promise<void> {
	for (let attempt = 0; attempt < 50 && mock.mock.calls.length < count; attempt++) {
		await new Promise<void>(resolve => setImmediate(() => resolve()));
	}
}
