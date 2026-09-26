import {act, renderHook, waitFor} from "@testing-library/react-native";
import React, {PropsWithChildren} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {NotificationPreferencesRes} from "ws-packets/src/fromServer/settings/NotificationPreferencesRes";
import {NotificationPreferences} from "ws-packets/src/objects/NotificationPreferences";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {GameClient} from "@/src/networking/GameClient";
import {cancelReportNotification, scheduleReportNotification} from "@/src/notifications/ReportNotifications";
import {useReportNotification} from "@/src/notifications/useNotifications";
import {useNotificationPreferenceChange} from "@/src/store/useNotificationPreferences";

const mockPushed = new Map<string, (packet: unknown) => void>();

jest.mock("expo-notifications", () => ({useLastNotificationResponse: jest.fn()}));
jest.mock("expo-router", () => ({useRouter: jest.fn(), useFocusEffect: jest.fn()}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({
	registerPushedPacketHandler: (name: string, handler: (packet: unknown) => void): () => void => {
		mockPushed.set(name, handler);
		return (): void => {mockPushed.delete(name);};
	}
})}}));
jest.mock("@/src/notifications/ReportNotifications", () => ({
	cancelReportNotification: jest.fn(),
	scheduleReportNotification: jest.fn(),
	isNotificationScreen: jest.fn(),
	NOTIFICATION_SCREEN_KEY: "screen",
	NOTIFICATION_SCREENS: {}
}));

const ALL_ON: NotificationPreferences = {
	report: true, dailyBonus: true, energy: true, guildDaily: true, guildKick: true,
	guildStatusChange: true, playerFreedFromJail: true, fightChallenge: true, petExpedition: true, tournament: true
};

function preferences(report: boolean): NotificationPreferencesRes {
	return Object.assign(new NotificationPreferencesRes(), {preferences: {...ALL_ON, report}});
}

function travelling(): ReportViewRes {
	return Object.assign(new ReportViewRes(), {
		reportReady: false,
		travel: {
			startMap: {id: 1, type: "main"}, endMap: {id: 2, type: "main"}, startTime: 0,
			arriveTime: Date.now() + 600_000, nextStopTime: Date.now() + 300_000, isOnBoat: false,
			points: {show: false, cumulated: 0}, energy: {show: false, current: 0, max: 0}, isInCity: false
		}
	});
}

function cacheWith(report: boolean): QueryClient {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity}}});
	client.setQueryData(gameKey(GAME_ENTITIES.REPORT), {kind: "answer", packet: travelling()});
	client.setQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES), {kind: "answer", packet: preferences(report)});
	return client;
}

function wrapper(client: QueryClient): React.FC<PropsWithChildren> {
	return ({children}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("app notification settings", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPushed.clear();
	});

	it("sends no report notification once the player turned it off in the app", async () => {
		await renderHook(useReportNotification, {wrapper: wrapper(cacheWith(false))});
		expect(cancelReportNotification).toHaveBeenCalled();
		expect(scheduleReportNotification).not.toHaveBeenCalled();
	});

	it("follows the settings the server pushes after taking over Discord's", async () => {
		await renderHook(useReportNotification, {wrapper: wrapper(cacheWith(false))});

		await act(async () => mockPushed.get(NotificationPreferencesRes.wireName)!(preferences(true)));

		await waitFor(() => expect(scheduleReportNotification).toHaveBeenCalledWith(expect.any(Number), "models:map_locations.2.name"));
	});

	it("cancels the pending notification as soon as the switch is turned off", async () => {
		const client = cacheWith(true);
		const {result} = await renderHook(() => {
			useReportNotification();
			return useNotificationPreferenceChange();
		}, {wrapper: wrapper(client)});
		expect(scheduleReportNotification).toHaveBeenCalled();
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: preferences(false)});

		await act(() => result.current.submit({type: "report", enabled: false}));

		expect(GameClient.request).toHaveBeenCalledWith(expect.objectContaining({type: "report", enabled: false}), NotificationPreferencesRes);
		expect(cancelReportNotification).toHaveBeenCalled();
	});
});
