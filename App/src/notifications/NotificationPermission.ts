import {useCallback, useEffect, useState} from "react";
import {AppState, Linking} from "react-native";
import {getPermissionsAsync, NotificationPermissionsStatus, requestPermissionsAsync} from "expo-notifications";
import {registerForPush} from "@/src/notifications/PushRegistration";

export const NOTIFICATION_PERMISSIONS = {
	GRANTED: "granted",

	/** Not allowed yet, and the system still lets the app ask. */
	ASKABLE: "askable",

	/** Refused: only the system settings can allow it now. */
	BLOCKED: "blocked"
} as const;

export type NotificationPermission = typeof NOTIFICATION_PERMISSIONS[keyof typeof NOTIFICATION_PERMISSIONS];

function permissionOf(status: NotificationPermissionsStatus): NotificationPermission {
	if (status.granted) return NOTIFICATION_PERMISSIONS.GRANTED;
	return status.canAskAgain ? NOTIFICATION_PERMISSIONS.ASKABLE : NOTIFICATION_PERMISSIONS.BLOCKED;
}

export type NotificationPermissionState = {
	permission: NotificationPermission | null;

	/** Asks the system, or opens its settings once the player refused there. */
	allow: () => void;
};

/** Whether the phone lets the app notify, kept up to date when the player comes back from the system settings. */
export function useNotificationPermission(): NotificationPermissionState {
	const [permission, setPermission] = useState<NotificationPermission | null>(null);
	const refresh = useCallback((): void => {
		getPermissionsAsync().then(status => setPermission(permissionOf(status))).catch(() => setPermission(null));
	}, []);
	useEffect(() => {
		refresh();
		const subscription = AppState.addEventListener("change", state => {
			if (state === "active") refresh();
		});
		return (): void => subscription.remove();
	}, [refresh]);
	const allow = useCallback((): void => {
		if (permission === NOTIFICATION_PERMISSIONS.BLOCKED) {
			Linking.openSettings().catch(error => console.warn("System settings not opened:", error));
			return;
		}
		requestPermissionsAsync()
			.then(status => {
				setPermission(permissionOf(status));
				return status.granted ? registerForPush() : undefined;
			})
			.catch(error => console.warn("Notifications not allowed:", error));
	}, [permission]);
	return {permission, allow};
}
