import {
	impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType, selectionAsync
} from "expo-haptics";
import { getVolume } from "react-native-volume-manager";
import {
	HAPTICS_MODES, hapticsPreference
} from "@/src/preferences/HapticsPreference";

async function hapticsAllowed(): Promise<boolean> {
	switch (hapticsPreference.getSnapshot()) {
		case HAPTICS_MODES.NEVER:
			return false;
		case HAPTICS_MODES.WITH_SOUND:
			return (await getVolume()).volume > 0;
		default:
			return true;
	}
}

/** A vibration is a nicety: when it cannot play, nothing else is held up. */
function play(feedback: () => Promise<void>): void {
	hapticsAllowed()
		.then(allowed => allowed ? feedback() : undefined)
		.catch(() => undefined);
}

/** Every vibration of the app goes through here, so the player's setting applies to all of them. */
export const Haptics = {
	impact: (style: ImpactFeedbackStyle): void => play(() => impactAsync(style)),
	notification: (type: NotificationFeedbackType): void => play(() => notificationAsync(type)),
	selection: (): void => play(selectionAsync)
};
