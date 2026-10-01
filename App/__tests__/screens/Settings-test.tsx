import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import {NotificationPreferencesRes} from "ws-packets/src/fromServer/settings/NotificationPreferencesRes";
import {NOTIFICATION_TYPES} from "ws-packets/src/objects/NotificationPreferences";
import {VersionRes} from "ws-packets/src/fromServer/common/PlayerUtilityRes";
import Settings from "@/app/(protected)/settings/index";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {GameClient} from "@/src/networking/GameClient";
import {forgetPushDevice} from "@/src/notifications/PushRegistration";
import {gameServicesStore, useGameServices} from "@/src/gameServices/GameServices";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS} from "@/src/gameServices/GameServicesTypes";

const mockPush = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({back: jest.fn(), push: mockPush})}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-notifications", () => ({getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn()}));
jest.mock("@/src/notifications/PushRegistration", () => ({registerForPush: jest.fn(() => Promise.resolve()), forgetPushDevice: jest.fn()}));
jest.mock("@/src/notifications/ReportNotifications", () => ({cancelReportNotification: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({disconnect: mockDisconnect, registerPushedPacketHandler: (): () => void => (): void => {}})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));
jest.mock("@/src/gameServices/GameServices", () => ({
	useGameServices: jest.fn(),
	gameServicesStore: {connect: jest.fn(() => Promise.resolve()), showAchievements: jest.fn(() => Promise.resolve()), showTopweekLeaderboard: jest.fn(() => Promise.resolve()), refresh: jest.fn(() => Promise.resolve())}
}));

const preferences = {
	report: true, dailyBonus: false, energy: true, guildDaily: true, guildKick: true,
	guildStatusChange: true, playerFreedFromJail: true, fightChallenge: false, petExpedition: true, tournament: true
};

function answers(packet: unknown): Promise<unknown> {
	if (packet instanceof Object && packet.constructor.name.startsWith("Version")) {
		return Promise.resolve({kind: "answer", packet: Object.assign(new VersionRes(), {coreVersion: "6.0.4"})});
	}
	return Promise.resolve({kind: "answer", packet: Object.assign(new NotificationPreferencesRes(), {preferences})});
}

async function renderSettings(auth = {setState: jest.fn(), clearToken: jest.fn(() => Promise.resolve())}): Promise<typeof auth> {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
	await render(<QueryClientProvider client={client}>
		<AuthContext.Provider value={auth as unknown as React.ContextType<typeof AuthContext>}><Settings /></AuthContext.Provider>
	</QueryClientProvider>);
	return auth;
}

describe("settings", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(useGameServices).mockReturnValue({provider: GAME_SERVICE_PROVIDERS.UNSUPPORTED, availability: GAME_SERVICE_AVAILABILITY.UNSUPPORTED, player: null, bestTopweekScore: 0, busy: false, syncFailed: false});
		jest.mocked(GameClient.request).mockImplementation(answers as typeof GameClient.request);
		jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({granted: true, canAskAgain: true} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
	});

	it("sums up the notifications and opens their page", async () => {
		await renderSettings();
		await waitFor(() => expect(screen.getByText(`app:settings.notifications.summary.count ${JSON.stringify({enabled: 8, total: Object.values(NOTIFICATION_TYPES).length})}`)).toBeTruthy());
		await fireEvent.press(screen.getByText("app:settings.notifications.entry"));
		expect(mockPush).toHaveBeenCalledWith("/settings/notifications");
	});

	it("says the phone blocks them rather than counting settings that do nothing", async () => {
		jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({granted: false, canAskAgain: false} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
		await renderSettings();
		await waitFor(() => expect(screen.getByText("app:settings.notifications.summary.off")).toBeTruthy());
	});
	it("opens the platform achievements and the best topweek leaderboard", async () => {
		jest.mocked(useGameServices).mockReturnValue({provider: GAME_SERVICE_PROVIDERS.GAME_CENTER, availability: GAME_SERVICE_AVAILABILITY.AVAILABLE, player: {id: "platform-player", displayName: "Profil plateforme"}, bestTopweekScore: 500, busy: false, syncFailed: false});
		await renderSettings();
		expect(screen.getByText("Profil plateforme")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:settings.gameServices.achievements"));
		await fireEvent.press(screen.getByText("app:settings.gameServices.leaderboard"));
		expect(gameServicesStore.showAchievements).toHaveBeenCalledTimes(1);
		expect(gameServicesStore.showTopweekLeaderboard).toHaveBeenCalledTimes(1);
	});

	it("offers platform authentication without changing the Crownicles account", async () => {
		jest.mocked(useGameServices).mockReturnValue({provider: GAME_SERVICE_PROVIDERS.GAME_CENTER, availability: GAME_SERVICE_AVAILABILITY.AVAILABLE, player: null, bestTopweekScore: 0, busy: false, syncFailed: false});
		const auth = await renderSettings();
		await fireEvent.press(screen.getByText(`app:settings.gameServices.connect ${JSON.stringify({provider: "app:settings.gameServices.providers.gameCenter"})}`));
		expect(gameServicesStore.connect).toHaveBeenCalledTimes(1);
		expect(auth.clearToken).not.toHaveBeenCalled();
		expect(mockDisconnect).not.toHaveBeenCalled();
	});

	it("explains missing platform configuration before offering any action", async () => {
		jest.mocked(useGameServices).mockReturnValue({provider: GAME_SERVICE_PROVIDERS.PLAY_GAMES, availability: GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED, player: null, bestTopweekScore: 0, busy: false, syncFailed: false});
		await renderSettings();
		expect(screen.getByText("app:settings.gameServices.unavailable.notConfigured")).toBeTruthy();
		expect(screen.queryByText("app:settings.gameServices.achievements")).toBeNull();
	});

	it("asks before logging out, then forgets this device and ends the session", async () => {
		const auth = await renderSettings();
		await fireEvent.press(screen.getByText("app:settings.logout"));
		expect(auth.setState).not.toHaveBeenCalled();

		await waitFor(() => expect(screen.getByText("app:settings.logoutConfirm.title")).toBeTruthy());
		await fireEvent.press(screen.getAllByText("app:settings.logout").at(-1)!);

		expect(forgetPushDevice).toHaveBeenCalled();
		expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN);
		expect(auth.clearToken).toHaveBeenCalled();
	});

	it("changes account directly without a confirmation, after forgetting the token and this device", async () => {
		const auth = await renderSettings();
		await fireEvent.press(screen.getByText("app:settings.changeAccount"));
		await waitFor(() => expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN));
		expect(auth.clearToken).toHaveBeenCalledTimes(1);
		expect(forgetPushDevice).toHaveBeenCalledTimes(1);
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("app:settings.logoutConfirm.title")).toBeNull();
	});

	it("does not expose the next login or delete the token twice while session cleanup is pending", async () => {
		let finish!: () => void;
		const clearing = new Promise<void>(resolve => { finish = resolve; });
		const auth = await renderSettings({setState: jest.fn(), clearToken: jest.fn(() => clearing)});
		await fireEvent.press(screen.getByText("app:settings.changeAccount"));
		await waitFor(() => expect(auth.clearToken).toHaveBeenCalledTimes(1));
		expect(screen.getByText("app:settings.leavingAccount")).toBeTruthy();
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("app:settings.changeAccount"));
		expect(auth.clearToken).toHaveBeenCalledTimes(1);
		expect(auth.setState).not.toHaveBeenCalled();
		await act(async (): Promise<void> => { finish(); });
		await waitFor(() => expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN));
	});

	it("keeps the current session recoverable when cleanup fails, then allows retrying", async () => {
		const auth = {setState: jest.fn(), clearToken: jest.fn().mockRejectedValueOnce(new Error("keychain unavailable")).mockResolvedValue(undefined)};
		await renderSettings(auth);
		await fireEvent.press(screen.getByText("app:settings.changeAccount"));
		await waitFor(() => expect(screen.getByText("app:settings.changeAccountFailed")).toBeTruthy());
		expect(auth.setState).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:settings.changeAccount"));
		await waitFor(() => expect(auth.setState).toHaveBeenCalledWith(AuthStateEnum.NO_TOKEN));
		expect(auth.clearToken).toHaveBeenCalledTimes(2);
	});
});
