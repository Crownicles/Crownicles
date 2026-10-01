import * as Notifications from "expo-notifications";
import {allowPermissionPrompt, cancelReportNotification, requestReportNotifications} from "@/src/notifications/ReportNotifications";
import {registerForPush} from "@/src/notifications/PushRegistration";

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
jest.mock("@/src/notifications/PushRegistration", () => ({registerForPush: jest.fn(() => Promise.resolve())}));

const mocked = jest.mocked(Notifications);

function allowed(granted: boolean, canAskAgain = false): void {
	mocked.getPermissionsAsync.mockResolvedValue({granted, canAskAgain} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
}

describe("server-only travel notifications", () => {
	beforeEach(() => jest.clearAllMocks());

	it("registers an allowed device without scheduling a local reminder", async () => {
		allowed(true);
		expect(await requestReportNotifications()).toBe(true);
		expect(registerForPush).toHaveBeenCalledTimes(1);
		expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
	});

	it("neither registers nor schedules when notifications are refused", async () => {
		allowed(false);
		expect(await requestReportNotifications()).toBe(false);
		expect(registerForPush).not.toHaveBeenCalled();
		expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
	});

	it("removes the old scheduled travel reminder instead of creating another", async () => {
		await cancelReportNotification();
		expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("report-ready");
		expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
	});

	it("does not ask before onboarding allows the permission prompt", () => {
		allowPermissionPrompt(false);
		expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
	});

	it("registers server pushes after the player accepts the permission", async () => {
		allowed(false, true);
		mocked.requestPermissionsAsync.mockResolvedValue({granted: true, canAskAgain: true} as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);
		expect(await requestReportNotifications()).toBe(true);
		expect(registerForPush).toHaveBeenCalledTimes(1);
		expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
	});
});
