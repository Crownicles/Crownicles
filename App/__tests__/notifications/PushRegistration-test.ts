import {Platform} from "react-native";
import {renderHook, waitFor} from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import * as Application from "expo-application";
import {PushDeviceRegisterReq, PushDeviceUnregisterReq} from "ws-packets/src/fromClient/PushDeviceReq";
import {PushDeviceRegisteredRes} from "ws-packets/src/fromServer/settings/PushDeviceRegisteredRes";
import {NOTIFICATION_TYPES} from "ws-packets/src/objects/NotificationPreferences";
import {GameClient} from "@/src/networking/GameClient";
import {forgetPushDevice, registerForPush, usePushRegistration} from "@/src/notifications/PushRegistration";

const mockSendPacket = jest.fn();

jest.mock("expo-notifications", () => ({
	getPermissionsAsync: jest.fn(),
	cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
	getDevicePushTokenAsync: jest.fn(),
	setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
	addPushTokenListener: jest.fn(() => ({remove: jest.fn()})),
	AndroidImportance: {DEFAULT: 3}
}));
jest.mock("expo-application", () => ({getIosPushNotificationServiceEnvironmentAsync: jest.fn()}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key, language: "fr"}}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: () => ({sendPacket: mockSendPacket})}}));

const mocked = jest.mocked(Notifications);
const IOS_TOKEN = "f".repeat(64);

function permission(granted: boolean): void {
	mocked.getPermissionsAsync.mockResolvedValue({granted, canAskAgain: true} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
}

function registeredWith(): PushDeviceRegisterReq {
	return jest.mocked(GameClient.request).mock.calls[0][0] as PushDeviceRegisterReq;
}

describe("push registration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		forgetPushDevice();
		mockSendPacket.mockClear();
		Platform.OS = "ios";
		mocked.getDevicePushTokenAsync.mockResolvedValue({type: "ios", data: IOS_TOKEN});
		jest.mocked(Application.getIosPushNotificationServiceEnvironmentAsync).mockResolvedValue("development");
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: new PushDeviceRegisteredRes()});
	});

	it("gives the server nothing until the player allowed notifications", async () => {
		permission(false);
		await registerForPush();
		expect(mocked.getDevicePushTokenAsync).not.toHaveBeenCalled();
		expect(GameClient.request).not.toHaveBeenCalled();
	});

	it("registers the device's token, its push gateway and the language the app is shown in", async () => {
		permission(true);
		await registerForPush();
		expect(registeredWith()).toBeInstanceOf(PushDeviceRegisterReq);
		expect({...registeredWith()}).toEqual({token: IOS_TOKEN, platform: "ios", sandbox: true, language: "fr"});
		expect(GameClient.request).toHaveBeenCalledWith(expect.anything(), PushDeviceRegisteredRes);
	});

	it("sends to Apple's production gateway from a build signed for the store", async () => {
		permission(true);
		jest.mocked(Application.getIosPushNotificationServiceEnvironmentAsync).mockResolvedValue("production");
		await registerForPush();
		expect(registeredWith().sandbox).toBe(false);
	});

	it("registers the same device only once while nothing changed", async () => {
		permission(true);
		await registerForPush();
		await registerForPush();
		expect(GameClient.request).toHaveBeenCalledTimes(1);
	});

	it("shares a registration already under way, as when the app starts and comes to the front at once", async () => {
		permission(true);
		await Promise.all([registerForPush(), registerForPush()]);
		expect(GameClient.request).toHaveBeenCalledTimes(1);
	});

	it("forgets the device on logout, so the next player does not receive this one's notifications", async () => {
		permission(true);
		await registerForPush();
		forgetPushDevice();
		expect(mockSendPacket).toHaveBeenCalledWith(expect.any(PushDeviceUnregisterReq), {});
		expect({...mockSendPacket.mock.calls[0][0]}).toEqual({token: IOS_TOKEN});

		await registerForPush();
		expect(GameClient.request).toHaveBeenCalledTimes(2);
	});

	it("creates one Android channel per kind, so each can be silenced from the system", async () => {
		permission(true);
		Platform.OS = "android";
		mocked.getDevicePushTokenAsync.mockResolvedValue({type: "android", data: "fcm:token"});
		await registerForPush();
		expect(mocked.setNotificationChannelAsync).toHaveBeenCalledTimes(Object.values(NOTIFICATION_TYPES).length);
		expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith("guildKick", expect.objectContaining({name: "app:notifications.channels.guildKick"}));
		expect(registeredWith()).toEqual(expect.objectContaining({platform: "android", sandbox: false}));
	});

	it("cancels old local reminders at startup and keeps registering for remote pushes", async () => {
		permission(true);
		await renderHook(usePushRegistration);
		expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("report-ready");
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledWith(expect.any(PushDeviceRegisterReq), PushDeviceRegisteredRes));
	});
});
