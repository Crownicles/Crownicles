import {createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {Appearance, StyleSheet, useColorScheme} from "react-native";
import {setBackgroundColorAsync} from "expo-system-ui";
import {Palette, PALETTES, PaletteColor, Tint} from "@/src/design/Theme";
import {ColorScheme, saveThemePreference, storedThemePreference, THEME_PREFERENCES, ThemePreference} from "@/src/design/ThemePreference";

type ThemeState = {
	preference: ThemePreference;
	scheme: ColorScheme;
	colors: Palette;
	setPreference: (preference: ThemePreference) => void;
};

/** Outside the root (tests, isolated renders), the app is drawn in its light palette. */
const ThemeContext = createContext<ThemeState>({
	preference: THEME_PREFERENCES.SYSTEM,
	scheme: THEME_PREFERENCES.LIGHT,
	colors: PALETTES[THEME_PREFERENCES.LIGHT],
	setPreference: () => undefined
});

/** Lets native surfaces (keyboard, alerts) follow the choice, and hands them back to the system otherwise. */
function applyNativeScheme(preference: ThemePreference): void {
	Appearance.setColorScheme(preference === THEME_PREFERENCES.SYSTEM ? "unspecified" : preference);
}

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
	if (preference !== THEME_PREFERENCES.SYSTEM) return preference;
	return system === THEME_PREFERENCES.DARK ? THEME_PREFERENCES.DARK : THEME_PREFERENCES.LIGHT;
}

/** The single source of the palette: a new choice or a new system scheme repaints the app in place. */
export function ThemeRoot({children}: {children: ReactNode}): ReactNode {
	const [preference, setStoredPreference] = useState(storedThemePreference);
	const system = useColorScheme();
	const scheme = resolveScheme(preference, system);

	useEffect(() => applyNativeScheme(storedThemePreference()), []);
	useEffect(() => {
		setBackgroundColorAsync(PALETTES[scheme].wash).catch(() => undefined);
	}, [scheme]);

	const setPreference = useCallback((next: ThemePreference): void => {
		saveThemePreference(next);
		applyNativeScheme(next);
		setStoredPreference(next);
	}, []);

	const value = useMemo((): ThemeState => ({preference, scheme, colors: PALETTES[scheme], setPreference}), [preference, scheme, setPreference]);
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
	return useContext(ThemeContext);
}

export function useColors(): Palette {
	return useContext(ThemeContext).colors;
}

/** Resolves a tint against the palette in use: roles follow the theme, fixed colours stay as they are. */
export function paletteColor(colors: Palette, tint: Tint): string {
	return tint.startsWith("#") ? tint : colors[tint as PaletteColor];
}

/** Styles built from the palette, once per palette, and rebuilt when the theme changes. */
export function createStyles<Styles extends StyleSheet.NamedStyles<Styles>>(factory: (colors: Palette) => Styles): () => Styles {
	const cache = new Map<Palette, Styles>();
	return function useStyles(): Styles {
		const colors = useColors();
		let styles = cache.get(colors);
		if (!styles) {
			styles = StyleSheet.create(factory(colors));
			cache.set(colors, styles);
		}
		return styles;
	};
}
