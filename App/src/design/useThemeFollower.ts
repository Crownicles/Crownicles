import {useEffect} from "react";
import {Appearance} from "react-native";
import {setBackgroundColorAsync} from "expo-system-ui";
import {reloadAppAsync} from "expo";
import {ACTIVE_COLOR_SCHEME, Theme} from "@/src/design/Theme";
import {
	resolveColorScheme, saveThemePreference, storedThemePreference, THEME_PREFERENCES, ThemePreference
} from "@/src/design/ThemePreference";

function reload(): void {
	reloadAppAsync().catch(error => console.error("Failed to reload the app for a new theme:", error));
}

function overrideNativeScheme(preference: ThemePreference): void {
	Appearance.setColorScheme(preference === THEME_PREFERENCES.SYSTEM ? "unspecified" : preference);
}

/** Styles are built once per launch, so a new palette means rebuilding them all: the app reloads itself. */
export function applyThemePreference(preference: ThemePreference): void {
	saveThemePreference(preference);
	overrideNativeScheme(preference);
	if (resolveColorScheme(preference) !== ACTIVE_COLOR_SCHEME) reload();
}

function systemMovedAwayFromTheme(): boolean {
	return storedThemePreference() === THEME_PREFERENCES.SYSTEM && resolveColorScheme(THEME_PREFERENCES.SYSTEM) !== ACTIVE_COLOR_SCHEME;
}

/**
 * Keeps native surfaces (keyboard, alerts, root background) in the app's palette, and follows the
 * system when the player left the choice to it.
 */
export function useThemeFollower(): void {
	useEffect(() => {
		overrideNativeScheme(storedThemePreference());
		setBackgroundColorAsync(Theme.colors.wash).catch(() => undefined);
		const subscription = Appearance.addChangeListener(() => {
			if (systemMovedAwayFromTheme()) reload();
		});
		return (): void => subscription.remove();
	}, []);
}
