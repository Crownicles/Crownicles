import {act, fireEvent, render, screen} from "@testing-library/react-native";
import React, {PropsWithChildren} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AppNotificationRes} from "ws-packets/src/fromServer/settings/AppNotificationRes";
import {NotificationType} from "ws-packets/src/objects/NotificationPreferences";
import {AppNotificationToast, appNotificationStore, useAppNotificationRefresh} from "@/src/components/AppNotificationToast";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({navigate: mockNavigate})}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));
jest.mock("@/src/components/UnlockCelebration", () => ({useAdventureBusy: jest.fn(() => false)}));
jest.mock("@/src/journey/useJourney", () => ({useJourney: (): object => ({unannounced: null})}));
jest.mock("@/src/store/MissionRewardsStore", () => ({useMissionRewards: jest.fn(() => ({unannounced: 0}))}));

async function notified(notificationType: NotificationType, title = "Exclu de la guilde"): Promise<void> {
	const packet: AppNotificationRes = {notificationType, title, body: "Gorgonzola vous a exclu de la guilde Les Fromages."};
	await act(async () => {
		Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry").dispatch(AppNotificationRes.wireName, packet);
	});
}

function Screen(): React.JSX.Element {
	useAppNotificationRefresh();
	return <AppNotificationToast />;
}

function withCache(client: QueryClient): React.FC<PropsWithChildren> {
	function Cache({children}: PropsWithChildren): React.JSX.Element {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	}
	return Cache;
}

describe("a notification received with the app open", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	afterEach(async () => {
		await act(async () => appNotificationStore.announced());
	});

	it("shows the words of the push, and a tap opens the screen it is about", async () => {
		await render(<Screen />, {wrapper: withCache(new QueryClient())});
		await notified("guildKick");

		expect(screen.getByText("Exclu de la guilde")).toBeTruthy();
		expect(screen.getByText("Gorgonzola vous a exclu de la guilde Les Fromages.")).toBeTruthy();
		await fireEvent.press(screen.getByText("Exclu de la guilde"));
		expect(mockNavigate).toHaveBeenCalledWith("/guild");
		expect(screen.queryByText("Exclu de la guilde")).toBeNull();
	});

	it("refreshes what it changed, so the screen it opens is up to date", async () => {
		const client = new QueryClient();
		const invalidate = jest.spyOn(client, "invalidateQueries");
		await render(<Screen />, {wrapper: withCache(client)});
		await notified("petExpedition", "Retour d'expédition");

		expect(invalidate).toHaveBeenCalledWith({queryKey: gameKey(GAME_ENTITIES.PET)});
	});

	it("leaves an arrival to the adventure screen, which already tells it, but still refreshes the report", async () => {
		const client = new QueryClient();
		const invalidate = jest.spyOn(client, "invalidateQueries");
		await render(<Screen />, {wrapper: withCache(client)});
		await notified("report", "Arrivée à destination");

		expect(screen.queryByText("Arrivée à destination")).toBeNull();
		expect(invalidate).toHaveBeenCalledWith({queryKey: gameKey(GAME_ENTITIES.REPORT)});
	});
});
