import {act, renderHook, waitFor} from "@testing-library/react-native";
import React, {PropsWithChildren} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {NotificationPreferencesRes} from "ws-packets/src/fromServer/settings/NotificationPreferencesRes";
import {NotificationPreferences} from "ws-packets/src/objects/NotificationPreferences";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {GameClient} from "@/src/networking/GameClient";
import {useNotificationPreferenceChange, useNotificationPreferences} from "@/src/store/useNotificationPreferences";

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
const ALL_ON: NotificationPreferences = {
	report: true, dailyBonus: true, energy: true, guildDaily: true, guildKick: true,
	guildStatusChange: true, playerFreedFromJail: true, fightChallenge: true, petExpedition: true, tournament: true
};

function preferences(report: boolean): NotificationPreferencesRes {
	return Object.assign(new NotificationPreferencesRes(), {preferences: {...ALL_ON, report}});
}

function cacheWith(report: boolean): QueryClient {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity}}});
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

	it("follows the settings the server pushes after taking over Discord's", async () => {
		const client = cacheWith(false);
		await renderHook(useNotificationPreferences, {wrapper: wrapper(client)});
		await act(async () => mockPushed.get(NotificationPreferencesRes.wireName)!(preferences(true)));
		await waitFor(() => expect(client.getQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES))).toMatchObject({packet: {preferences: {report: true}}}));
	});

	it("updates the arrival setting only after the server confirms it", async () => {
		const client = cacheWith(true);
		const {result} = await renderHook(useNotificationPreferenceChange, {wrapper: wrapper(client)});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: preferences(false)});

		await act(() => result.current.submit({type: "report", enabled: false}));

		expect(GameClient.request).toHaveBeenCalledWith(expect.objectContaining({type: "report", enabled: false}), NotificationPreferencesRes);
		expect(client.getQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES))).toMatchObject({packet: {preferences: {report: false, energy: true}}});
	});

	it("preserves the server preference when the update times out", async () => {
		const client = cacheWith(true);
		const {result} = await renderHook(useNotificationPreferenceChange, {wrapper: wrapper(client)});
		jest.mocked(GameClient.request).mockResolvedValue({kind: "timeout"});
		await act(() => result.current.submit({type: "report", enabled: false}));
		expect(client.getQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES))).toMatchObject({packet: {preferences: {report: true}}});
	});
});
