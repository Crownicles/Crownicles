import {useEffect, useRef} from "react";
import {useRouter} from "expo-router";
import {useLastNotificationResponse} from "expo-notifications";
import {isNotificationType, NOTIFICATION_ROUTES, NOTIFICATION_TYPE_KEY} from "@/src/notifications/NotificationRoutes";

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
