import {useEffect} from "react";
import {AppState, Platform} from "react-native";
import {
	addPushTokenListener,
	AndroidImportance,
	cancelScheduledNotificationAsync,
	DevicePushToken,
	getDevicePushTokenAsync,
	getPermissionsAsync,
	setNotificationChannelAsync
} from "expo-notifications";
import {getIosPushNotificationServiceEnvironmentAsync} from "expo-application";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PushDeviceRegisterReq, PushDeviceUnregisterReq} from "ws-packets/src/fromClient/PushDeviceReq";
import {PushDeviceRegisteredRes} from "ws-packets/src/fromServer/settings/PushDeviceRegisteredRes";
import {PUSH_PLATFORMS, PushPlatform} from "ws-packets/src/objects/PushDevices";
import {GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {ALL_NOTIFICATION_TYPES, LEGACY_TRAVEL_NOTIFICATION_ID} from "@/src/notifications/NotificationRoutes";
import {i18n} from "@/src/translations/i18n";

/** The token the server was last given for this device, and in which language, while the player is logged in. */
let registered: {token: string; language: string} | null = null;

function platformOf(token: DevicePushToken): PushPlatform | null {
	if (token.type === "ios") return PUSH_PLATFORMS.IOS;
	return token.type === "android" ? PUSH_PLATFORMS.ANDROID : null;
}

/** A build signed to debug gets its token from Apple's development gateway, which production cannot reach. */
async function isSandbox(platform: PushPlatform): Promise<boolean> {
	return platform === PUSH_PLATFORMS.IOS && await getIosPushNotificationServiceEnvironmentAsync() === "development";
}

/** Android files every notification under a channel the player can silence from the system: one per kind. */
async function ensureChannels(): Promise<void> {
	if (Platform.OS !== "android") return;
	await Promise.all(ALL_NOTIFICATION_TYPES.map(type => setNotificationChannelAsync(type, {
		name: i18n.t(`app:notifications.channels.${type}`),
		importance: AndroidImportance.DEFAULT
	})));
}

/** The registration under way, so the start of the app and its coming back to the front share it. */
let pending: {key: string; done: Promise<void>} | null = null;

async function send(token: string, platform: PushPlatform, language: string): Promise<void> {
	await ensureChannels();
	const answer = await GameClient.request(makeFromClientPacket(PushDeviceRegisterReq, {
		token,
		platform,
		sandbox: await isSandbox(platform),
		language
	}), PushDeviceRegisteredRes);
	if (answer.kind === "answer") registered = {token, language};
}

function pendingRegistration(token: string, platform: PushPlatform, language: string): Promise<void> {
	const key = `${token}/${language}`;
	if (pending?.key !== key) {
		const done = send(token, platform, language).finally(() => {
			if (pending?.done === done) pending = null;
		});
		pending = {key, done};
	}
	return pending.done;
}

function register(token: DevicePushToken): Promise<void> {
	const platform = platformOf(token);
	const language = i18n.language;
	if (!platform || typeof token.data !== "string") return Promise.resolve();
	if (registered?.token === token.data && registered.language === language) return Promise.resolve();
	return pendingRegistration(token.data, platform, language);
}

/** Gives the server this device's token, once the player allowed notifications; asking is left to the screens that explain why. */
export async function registerForPush(): Promise<void> {
	if (!(await getPermissionsAsync()).granted) return;
	await register(await getDevicePushTokenAsync());
}

function registerQuietly(): void {
	registerForPush().catch(error => console.warn("Push notifications unavailable:", error));
}

/** Before logging out: the next player on this device must not receive this one's notifications. */
export function forgetPushDevice(): void {
	if (!registered) return;
	WebSocketClient.getInstance().sendPacket(makeFromClientPacket(PushDeviceUnregisterReq, {token: registered.token}), {});
	registered = null;
}

/**
 * Keeps the server able to reach this device while the player is logged in: at start, each time the app
 * comes back (the player may have allowed notifications in the system settings meanwhile), and whenever the
 * push service renews the token.
 */
export function usePushRegistration(): void {
	useEffect(() => {
		cancelScheduledNotificationAsync(LEGACY_TRAVEL_NOTIFICATION_ID).catch(error => console.warn("Legacy travel notification not cancelled:", error));
		registerQuietly();
		const appState = AppState.addEventListener("change", state => {
			if (state === "active") registerQuietly();
		});
		const tokens = addPushTokenListener(token => {
			register(token).catch(error => console.warn("Push token not renewed:", error));
		});
		return (): void => {
			appState.remove();
			tokens.remove();
			// Whoever logs in next registers again, even with the same token
			registered = null;
		};
	}, []);
}
