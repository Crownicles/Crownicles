import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import {NotificationPreferencesRes} from "ws-packets/src/fromServer/settings/NotificationPreferencesRes";
import {NotificationPreferenceSetReq} from "ws-packets/src/fromClient/NotificationPreferencesReq";
import {NOTIFICATION_TYPES, NotificationPreferences} from "ws-packets/src/objects/NotificationPreferences";
import NotificationSettings from "@/app/(protected)/settings/notifications";
import {GameClient} from "@/src/networking/GameClient";
import {NOTIFICATION_GROUPS} from "@/src/store/useNotificationPreferences";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({back: jest.fn()})}));
jest.mock("expo-notifications", () => ({getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn()}));
jest.mock("@/src/notifications/PushRegistration", () => ({registerForPush: jest.fn(() => Promise.resolve())}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({registerPushedPacketHandler: (): () => void => (): void => {}})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));

const ALL_ON: NotificationPreferences = {
	report: true, dailyBonus: true, energy: true, guildDaily: true, guildKick: true,
	guildStatusChange: true, playerFreedFromJail: true, fightChallenge: true, petExpedition: true, tournament: true
};

function answer(preferences: NotificationPreferences): {kind: "answer"; packet: NotificationPreferencesRes} {
	return {kind: "answer", packet: Object.assign(new NotificationPreferencesRes(), {preferences})};
}

function permission(granted: boolean, canAskAgain = true): void {
	jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({granted, canAskAgain} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
}

async function renderSettings(): Promise<void> {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
	await render(<QueryClientProvider client={client}><NotificationSettings /></QueryClientProvider>);
}

describe("notification settings", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(GameClient.request).mockResolvedValue(answer(ALL_ON));
	});

	it("gathers every kind once, under the part of the game it comes from", () => {
		const listed = NOTIFICATION_GROUPS.flatMap(group => [...group.types]);
		expect([...listed].sort()).toEqual(Object.values(NOTIFICATION_TYPES).sort());
	});

	it("shows one switch per kind, with what it tells, once the server answered", async () => {
		permission(true);
		await renderSettings();
		await waitFor(() => expect(screen.getByRole("switch", {name: "app:settings.notifications.types.tournament"})).toBeTruthy());
		expect(screen.getAllByRole("switch")).toHaveLength(Object.values(NOTIFICATION_TYPES).length);
		expect(screen.getByText("app:settings.notifications.captions.petExpedition")).toBeTruthy();
		expect(screen.queryByTestId("notifications-permission")).toBeNull();
	});

	it("turns a kind off from anywhere on its row", async () => {
		permission(true);
		await renderSettings();
		await waitFor(() => expect(screen.getByRole("switch", {name: "app:settings.notifications.types.energy"})).toBeTruthy());
		jest.mocked(GameClient.request).mockResolvedValue(answer({...ALL_ON, energy: false}));

		await fireEvent.press(screen.getByText("app:settings.notifications.captions.energy"));

		expect(GameClient.request).toHaveBeenLastCalledWith(expect.any(NotificationPreferenceSetReq), NotificationPreferencesRes);
		expect(jest.mocked(GameClient.request).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({type: "energy", enabled: false}));
	});

	it("puts the way to allow notifications first while the phone refuses them", async () => {
		permission(false);
		await renderSettings();
		await waitFor(() => expect(screen.getByText("app:settings.notifications.permission.allow")).toBeTruthy());
		expect(screen.getByText("app:settings.notifications.permission.off")).toBeTruthy();
	});

	it("sends the player to the phone's settings once the app may no longer ask", async () => {
		permission(false, false);
		await renderSettings();
		await waitFor(() => expect(screen.getByText("app:settings.notifications.permission.openSettings")).toBeTruthy());
	});
});
