import {
	cancelScheduledNotificationAsync,
	getPermissionsAsync,
	requestPermissionsAsync,
	setNotificationHandler
} from "expo-notifications";
import {registerForPush} from "@/src/notifications/PushRegistration";
import {LEGACY_TRAVEL_NOTIFICATION_ID} from "@/src/notifications/NotificationRoutes";

// While the app is open the screen already tells what changed, pushed or not: the notification is for when it is not.
setNotificationHandler({
	handleNotification: () => Promise.resolve({shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false})
});

export function cancelReportNotification(): Promise<void> {
	return cancelScheduledNotificationAsync(LEGACY_TRAVEL_NOTIFICATION_ID).catch(error => console.warn("Legacy travel notification not cancelled:", error));
}

/** Whether the player already lets the app remind them of their reports. */
export async function reportNotificationsAllowed(): Promise<boolean> {
	return (await getPermissionsAsync()).granted;
}

/** Asks the player, then registers the device so Core alone decides when a notification is due. */
export async function requestReportNotifications(): Promise<boolean> {
	const current = await getPermissionsAsync();
	const granted = current.granted || current.canAskAgain && (await requestPermissionsAsync()).granted;
	if (granted) await registerForPush().catch(error => console.warn("Push notifications unavailable:", error));
	return granted;
}

export function allowPermissionPrompt(allowed: boolean): void {
	if (allowed) requestReportNotifications().catch(error => console.warn("Push notifications not allowed:", error));
}
