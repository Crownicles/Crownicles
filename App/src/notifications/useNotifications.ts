import {useEffect, useRef} from "react";
import {useRouter} from "expo-router";
import {useLastNotificationResponse} from "expo-notifications";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {reportReadyAt} from "@/src/display/ReportTiming";
import {cancelReportNotification, isNotificationScreen, NOTIFICATION_SCREEN_KEY, NOTIFICATION_SCREENS, scheduleReportNotification} from "@/src/notifications/ReportNotifications";
import {useReportView} from "@/src/store/useReportActions";
import {isNotificationEnabled, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {NOTIFICATION_TYPES} from "ws-packets/src/objects/NotificationPreferences";
import {i18n} from "@/src/translations/i18n";

type ReportReminder = {readyAt: number; destination: string};

/** A report still to wait for, or nothing when it can be opened already or the player is in a city. */
export function reportReminder(view: ReportViewRes): ReportReminder | null {
	const travel = view.travel;
	if (view.reportReady || view.city || !travel) return null;
	const readyAt = reportReadyAt(travel);
	if (readyAt === undefined) return null;
	const destination = travel.endMap.id > 0
		? i18n.t(`models:map_locations.${travel.endMap.id}.name`)
		: i18n.t("app:adventure.unknownLocation");
	return {readyAt, destination};
}

/** Keeps the report notification in step with the report the server last described and with the player's setting. */
export function useReportNotification(): void {
	const state = useReportView();
	const enabled = isNotificationEnabled(useNotificationPreferences(), NOTIFICATION_TYPES.REPORT);
	const reminder = enabled && state.status === "ready" ? reportReminder(state.data) : null;
	const readyAt = reminder?.readyAt;
	const destination = reminder?.destination;
	useEffect(() => {
		if (readyAt === undefined || destination === undefined) cancelReportNotification();
		else scheduleReportNotification(readyAt, destination);
	}, [readyAt, destination]);
}

/** Tapping a notification opens the screen it is about, once per notification. */
export function useNotificationNavigation(): void {
	const router = useRouter();
	const response = useLastNotificationResponse();
	const handled = useRef<string | null>(null);
	useEffect(() => {
		if (!response) return;
		const id = response.notification.request.identifier + response.notification.date;
		if (handled.current === id) return;
		handled.current = id;
		const screen = response.notification.request.content.data?.[NOTIFICATION_SCREEN_KEY];
		if (isNotificationScreen(screen)) router.navigate(NOTIFICATION_SCREENS[screen]);
	}, [response, router]);
}
