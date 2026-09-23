import {Appearance} from "react-native";
import {getItem, setItem} from "expo-secure-store";

export const THEME_PREFERENCES = {
	SYSTEM: "system",
	LIGHT: "light",
	DARK: "dark"
} as const;
export type ThemePreference = typeof THEME_PREFERENCES[keyof typeof THEME_PREFERENCES];

export type ColorScheme = typeof THEME_PREFERENCES.LIGHT | typeof THEME_PREFERENCES.DARK;

const STORAGE_KEY = "themePreference";

function isThemePreference(value: string | null): value is ThemePreference {
	return Object.values(THEME_PREFERENCES).some(preference => preference === value);
}

/**
 * Read synchronously: the palette must be known before any module builds its styles, since
 * `StyleSheet.create` copies the colours once, at load time.
 */
export function storedThemePreference(): ThemePreference {
	try {
		const stored = getItem(STORAGE_KEY);
		return isThemePreference(stored) ? stored : THEME_PREFERENCES.SYSTEM;
	}
	catch {
		return THEME_PREFERENCES.SYSTEM;
	}
}

export function saveThemePreference(preference: ThemePreference): void {
	setItem(STORAGE_KEY, preference);
}

export function systemColorScheme(): ColorScheme {
	return Appearance.getColorScheme() === THEME_PREFERENCES.DARK ? THEME_PREFERENCES.DARK : THEME_PREFERENCES.LIGHT;
}

export function resolveColorScheme(preference: ThemePreference): ColorScheme {
	return preference === THEME_PREFERENCES.SYSTEM ? systemColorScheme() : preference;
}
