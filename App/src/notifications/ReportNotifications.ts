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
import {i18n} from "@/src/translations/i18n";

/** The screens a notification can open, named in its data rather than carrying a route. */
export const NOTIFICATION_SCREENS = {adventure: "/"} as const;
export type NotificationScreen = keyof typeof NOTIFICATION_SCREENS;
export const NOTIFICATION_SCREEN_KEY = "screen";

export function isNotificationScreen(value: unknown): value is NotificationScreen {
	return typeof value === "string" && Object.hasOwn(NOTIFICATION_SCREENS, value);
}

const REPORT_NOTIFICATION = {id: "report-ready", channel: "report"} as const;

/** A report opening in a few seconds is seen on screen; notifying it would only arrive after the fact. */
const MIN_LEAD_MS = 5_000;

// While the app is open the screen already tells what changed: the notification is for when it is not.
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

async function canNotify(): Promise<boolean> {
	const current = await getPermissionsAsync();
	if (current.granted) return true;
	if (!current.canAskAgain || !permissionPromptAllowed) return false;
	return (await requestPermissionsAsync()).granted;
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
			data: {[NOTIFICATION_SCREEN_KEY]: "adventure" satisfies NotificationScreen}
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
	const granted = current.granted || current.canAskAgain && (await requestPermissionsAsync()).granted;
	if (granted && lastReminder) scheduleReportNotification(lastReminder.readyAt, lastReminder.destination);
	return granted;
}
