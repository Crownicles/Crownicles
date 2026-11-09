import {
	DevicePreference, useDevicePreference
} from "@/src/preferences/DevicePreference";

export const HAPTICS_MODES = {
	ALWAYS: "always",
	WITH_SOUND: "withSound",
	NEVER: "never"
} as const;
export type HapticsMode = typeof HAPTICS_MODES[keyof typeof HAPTICS_MODES];

/** When the app may vibrate; a device setting, like the theme. */
export const hapticsPreference = new DevicePreference<HapticsMode>("haptics", Object.values(HAPTICS_MODES), HAPTICS_MODES.ALWAYS);

export function useHapticsMode(): HapticsMode {
	return useDevicePreference(hapticsPreference);
}
