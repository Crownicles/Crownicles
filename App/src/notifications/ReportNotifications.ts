import * as Notifications from "expo-notifications";
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
Notifications.setNotificationHandler({
	handleNotification: () => Promise.resolve({shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false})
});

/** Scheduling runs one change at a time, so a quick succession of reports always ends on the latest one. */
let pending: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
	pending = pending.then(task).catch(error => console.warn("Report notification not updated:", error));
}

async function canNotify(): Promise<boolean> {
	const current = await Notifications.getPermissionsAsync();
	if (current.granted) return true;
	if (!current.canAskAgain) return false;
	return (await Notifications.requestPermissionsAsync()).granted;
}

async function ensureReportChannel(): Promise<void> {
	if (Platform.OS !== "android") return;
	await Notifications.setNotificationChannelAsync(REPORT_NOTIFICATION.channel, {
		name: i18n.t("app:notifications.channels.report"),
		importance: Notifications.AndroidImportance.DEFAULT
	});
}

async function schedule(readyAt: number, destination: string): Promise<void> {
	await Notifications.cancelScheduledNotificationAsync(REPORT_NOTIFICATION.id);
	if (readyAt - Date.now() < MIN_LEAD_MS || !await canNotify()) return;
	await ensureReportChannel();
	await Notifications.scheduleNotificationAsync({
		identifier: REPORT_NOTIFICATION.id,
		content: {
			title: i18n.t("app:notifications.reportReady.title"),
			body: i18n.t("app:notifications.reportReady.body", {destination}),
			data: {[NOTIFICATION_SCREEN_KEY]: "adventure" satisfies NotificationScreen}
		},
		trigger: {type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(readyAt), channelId: REPORT_NOTIFICATION.channel}
	});
}

/** Tells the player, even with the app closed, when their next report can be opened. */
export function scheduleReportNotification(readyAt: number, destination: string): void {
	enqueue(() => schedule(readyAt, destination));
}

export function cancelReportNotification(): void {
	enqueue(() => Notifications.cancelScheduledNotificationAsync(REPORT_NOTIFICATION.id));
}
