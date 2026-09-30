import {useEffect, useRef} from "react";
import {useRouter} from "expo-router";
import {useLastNotificationResponse} from "expo-notifications";
import {ReportViewRes} from "ws-packets/src/fromServer/report/ReportViewRes";
import {reportReadyAt} from "@/src/display/ReportTiming";
import {cancelReportNotification, scheduleReportNotification} from "@/src/notifications/ReportNotifications";
import {isNotificationType, NOTIFICATION_ROUTES, NOTIFICATION_TYPE_KEY} from "@/src/notifications/NotificationRoutes";
import {usePushActive} from "@/src/notifications/PushRegistration";
import {useReportView} from "@/src/store/useReportActions";
import {isNotificationEnabled, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {NOTIFICATION_TYPES} from "ws-packets/src/objects/NotificationPreferences";
import {i18n} from "@/src/translations/i18n";

type ReportReminder = {readyAt: number; destination: string; arrival: boolean};

/** A report still to wait for, or nothing when it can be opened already or the player is in a city. */
export function reportReminder(view: ReportViewRes): ReportReminder | null {
	if (view.reportReady) return null;
	const travel = view.travel;
	if (!travel || view.city) return null;
	const readyAt = reportReadyAt(travel);
	if (readyAt === undefined) return null;
	const destination = travel.endMap.id > 0
		? i18n.t(`models:map_locations.${travel.endMap.id}.name`)
		: i18n.t("app:adventure.unknownLocation");
	return {readyAt, destination, arrival: readyAt >= travel.arriveTime};
}

function localReportReminder(view: ReportViewRes, pushed: boolean): ReportReminder | null {
	const reminder = reportReminder(view);
	if (pushed && reminder?.arrival) return null;
	return reminder;
}

/**
 * Keeps the report notification in step with the report the server last described and with the player's setting.
 * The server pushes the arrival itself once it can reach the device: the app then only reminds of the stops.
 */
export function useReportNotification(): void {
	const state = useReportView();
	const enabled = isNotificationEnabled(useNotificationPreferences(), NOTIFICATION_TYPES.REPORT);
	const pushed = usePushActive();
	const wanted = enabled && state.status === "ready" ? localReportReminder(state.data, pushed) : null;
	const readyAt = wanted?.readyAt;
	const destination = wanted?.destination;
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
		const type = response.notification.request.content.data?.[NOTIFICATION_TYPE_KEY];
		if (isNotificationType(type)) router.navigate(NOTIFICATION_ROUTES[type]);
	}, [response, router]);
}
