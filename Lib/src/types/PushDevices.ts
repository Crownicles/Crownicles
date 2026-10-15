import { Language } from "../Language";

/** The push services a device can be reached through. */
export const PUSH_PLATFORMS = {
	IOS: "ios",
	ANDROID: "android"
} as const;

export type PushPlatform = typeof PUSH_PLATFORMS[keyof typeof PUSH_PLATFORMS];

/** FCM tokens run to about 200 characters, APNs ones to 64: the column leaves room for both to grow. */
export const PUSH_TOKEN_MAX_LENGTH = 512;

export function isPushPlatform(value: unknown): value is PushPlatform {
	return typeof value === "string" && (Object.values(PUSH_PLATFORMS) as string[]).includes(value);
}

export function isPushToken(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= PUSH_TOKEN_MAX_LENGTH && (/^[\w:.-]+$/u).test(value);
}

/**
 * Where to push a notification, and in which language: the one the app is shown in on that device.
 * `sandbox` sends to Apple's development gateway, for builds signed to debug.
 */
export type PushDevice = {
	token: string;
	platform: PushPlatform;
	sandbox: boolean;
	language: Language;
};
