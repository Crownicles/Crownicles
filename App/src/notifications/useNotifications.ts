import {useEffect, useRef} from "react";
import {AppState} from "react-native";
import {useRouter} from "expo-router";
import {useLastNotificationResponse} from "expo-notifications";
import {isNotificationType, NOTIFICATION_ROUTES, NOTIFICATION_TYPE_KEY} from "@/src/notifications/NotificationRoutes";

/** Tapping a notification opens the screen it is about, once per notification, once the app is in the foreground. */
export function useNotificationNavigation(): void {
	const router = useRouter();
	const response = useLastNotificationResponse();
	const handled = useRef<string | null>(null);
	useEffect(() => {
		if (!response) return undefined;
		const id = response.notification.request.identifier + response.notification.date;
		if (handled.current === id) return undefined;
		const open = (): void => {
			handled.current = id;
			const type = response.notification.request.content.data?.[NOTIFICATION_TYPE_KEY];
			if (isNotificationType(type)) router.navigate(NOTIFICATION_ROUTES[type]);
		};
		// Navigating while the app still wakes up changes screens under windows iOS is not ready to move.
		if (AppState.currentState === "active") {
			open();
			return undefined;
		}
		const subscription = AppState.addEventListener("change", state => {
			if (state !== "active") return;
			subscription.remove();
			open();
		});
		return (): void => subscription.remove();
	}, [response, router]);
}
