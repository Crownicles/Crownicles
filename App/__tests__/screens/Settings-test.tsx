import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
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

const mockPush = jest.fn();

jest.mock("expo-router", () => ({useFocusEffect: jest.fn(), useRouter: () => ({back: jest.fn(), push: mockPush})}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-notifications", () => ({getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn()}));
jest.mock("@/src/notifications/PushRegistration", () => ({registerForPush: jest.fn(() => Promise.resolve()), forgetPushDevice: jest.fn()}));
jest.mock("@/src/notifications/ReportNotifications", () => ({cancelReportNotification: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({registerPushedPacketHandler: (): () => void => (): void => {}})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => `icon:${path}`}}));

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
});
