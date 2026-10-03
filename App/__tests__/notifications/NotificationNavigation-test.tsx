import {act, renderHook} from "@testing-library/react-native";
import {AppState, AppStateStatus} from "react-native";
import {useLastNotificationResponse} from "expo-notifications";
import {useNotificationNavigation} from "@/src/notifications/useNotifications";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({useRouter: () => ({navigate: mockNavigate})}));
jest.mock("expo-notifications", () => ({useLastNotificationResponse: jest.fn()}));

function tapped(notificationType: string): ReturnType<typeof useLastNotificationResponse> {
	return {notification: {date: 1, request: {identifier: "tap", content: {data: {notificationType}}}}} as unknown as ReturnType<typeof useLastNotificationResponse>;
}

function setAppState(state: AppStateStatus): void {
	Object.defineProperty(AppState, "currentState", {value: state, configurable: true});
}

describe("tapping a notification", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setAppState("active");
	});

	it("opens the screen it is about at once when the app is in the foreground", async () => {
		jest.mocked(useLastNotificationResponse).mockReturnValue(tapped("energy"));
		await renderHook(useNotificationNavigation);
		expect(mockNavigate).toHaveBeenCalledWith("/arena");
	});

	it("waits for the app to be in the foreground before changing screens", async () => {
		setAppState("inactive");
		jest.mocked(useLastNotificationResponse).mockReturnValue(tapped("energy"));
		await renderHook(useNotificationNavigation);
		expect(mockNavigate).not.toHaveBeenCalled();

		const onChange = jest.mocked(AppState.addEventListener).mock.calls.at(-1)![1] as (state: AppStateStatus) => void;
		setAppState("active");
		await act(async () => onChange("active"));
		expect(mockNavigate).toHaveBeenCalledWith("/arena");
	});
});
