import {
	NOTIFICATION_TYPES, NotificationType
} from "../../../Lib/src/types/NotificationPreferences";
import { PushDevice } from "../../../Lib/src/types/PushDevices";
import { PushText } from "./PushTexts";

/** What a push service is asked to show. */
export type PushMessage = PushText & {
	notificationType: NotificationType;
};

export const PUSH_RESULTS = {
	SENT: "sent",

	/** The push service no longer knows the device: the app was uninstalled or its token renewed. */
	INVALID_TOKEN: "invalidToken",
	FAILED: "failed",

	/** This server has no credentials for the device's push service. */
	UNAVAILABLE: "unavailable"
} as const;

export type PushResult = typeof PUSH_RESULTS[keyof typeof PUSH_RESULTS];

export interface PushSender {
	send(device: PushDevice, message: PushMessage): Promise<PushResult>;
}

/**
 * Kinds that describe a state rather than an event: a newer one replaces the older on the lock screen,
 * so a player back from a weekend finds one arrival, not ten.
 */
const COLLAPSED_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
	NOTIFICATION_TYPES.REPORT,
	NOTIFICATION_TYPES.DAILY_BONUS,
	NOTIFICATION_TYPES.ENERGY,
	NOTIFICATION_TYPES.PET_EXPEDITION
]);

export function collapseKeyOf(type: NotificationType): string | undefined {
	return COLLAPSED_TYPES.has(type) ? type : undefined;
}

/** Push services sign with JSON Web Tokens: unpadded base64 of the header, the claims, then the signature. */
export function base64UrlJson(value: object): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}
