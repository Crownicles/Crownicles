import {
	AndroidImportance,
	cancelScheduledNotificationAsync,
	getPermissionsAsync,
	requestPermissionsAsync,
	SchedulableTriggerInputTypes,
	scheduleNotificationAsync,
	setNotificationChannelAsync,
	setNotificationHandler
} from "expo-notifications";
import {Platform} from "react-native";
import {NOTIFICATION_TYPES} from "ws-packets/src/objects/NotificationPreferences";
import {i18n} from "@/src/translations/i18n";
import {NOTIFICATION_TYPE_KEY} from "@/src/notifications/NotificationRoutes";
import {registerForPush} from "@/src/notifications/PushRegistration";

const REPORT_NOTIFICATION = {id: "report-ready", channel: NOTIFICATION_TYPES.REPORT} as const;

/** A report opening in a few seconds is seen on screen; notifying it would only arrive after the fact. */
const MIN_LEAD_MS = 5_000;

// While the app is open the screen already tells what changed, pushed or not: the notification is for when it is not.
setNotificationHandler({
	handleNotification: () => Promise.resolve({shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false})
});

/** Scheduling runs one change at a time, so a quick succession of reports always ends on the latest one. */
let pending: Promise<void> = Promise.resolve();

/** The last report the player asked to be reminded of, scheduled again once they allow notifications. */
let lastReminder: {readyAt: number; destination: string} | null = null;

/**
 * A newcomer is asked once the guide has told them why the notification matters, never cold:
 * a refusal can seldom be undone. Until the app knows the player is past the contest, it waits.
 */
let permissionPromptAllowed = false;

export function allowPermissionPrompt(allowed: boolean): void {
	permissionPromptAllowed = allowed;
}

function enqueue(task: () => Promise<void>): void {
	pending = pending.then(task).catch(error => console.warn("Report notification not updated:", error));
}

/** Once the player allows notifications, the server is told where to push them. */
function allowed(permission: {granted: boolean}): boolean {
	if (permission.granted) registerForPush().catch(error => console.warn("Push notifications unavailable:", error));
	return permission.granted;
}

async function canNotify(): Promise<boolean> {
	const current = await getPermissionsAsync();
	if (current.granted) return true;
	if (!current.canAskAgain || !permissionPromptAllowed) return false;
	return allowed(await requestPermissionsAsync());
}

async function ensureReportChannel(): Promise<void> {
	if (Platform.OS !== "android") return;
	await setNotificationChannelAsync(REPORT_NOTIFICATION.channel, {
		name: i18n.t("app:notifications.channels.report"),
		importance: AndroidImportance.DEFAULT
	});
}

async function schedule(readyAt: number, destination: string): Promise<void> {
	await cancelScheduledNotificationAsync(REPORT_NOTIFICATION.id);
	if (readyAt - Date.now() < MIN_LEAD_MS || !await canNotify()) return;
	await ensureReportChannel();
	await scheduleNotificationAsync({
		identifier: REPORT_NOTIFICATION.id,
		content: {
			title: i18n.t("app:notifications.reportReady.title"),
			body: i18n.t("app:notifications.reportReady.body", {destination}),
			data: {[NOTIFICATION_TYPE_KEY]: NOTIFICATION_TYPES.REPORT}
		},
		trigger: {type: SchedulableTriggerInputTypes.DATE, date: new Date(readyAt), channelId: REPORT_NOTIFICATION.channel}
	});
}

/** Tells the player, even with the app closed, when their next report can be opened. */
export function scheduleReportNotification(readyAt: number, destination: string): void {
	lastReminder = {readyAt, destination};
	enqueue(() => schedule(readyAt, destination));
}

export function cancelReportNotification(): void {
	lastReminder = null;
	enqueue(() => cancelScheduledNotificationAsync(REPORT_NOTIFICATION.id));
}

/** Whether the player already lets the app remind them of their reports. */
export async function reportNotificationsAllowed(): Promise<boolean> {
	return (await getPermissionsAsync()).granted;
}

/** Asks the player, who chose to be reminded, then reminds them of the report already waiting. */
export async function requestReportNotifications(): Promise<boolean> {
	const current = await getPermissionsAsync();
	const granted = current.granted || current.canAskAgain && allowed(await requestPermissionsAsync());
	if (granted && lastReminder) scheduleReportNotification(lastReminder.readyAt, lastReminder.destination);
	return granted;
}
