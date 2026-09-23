import {DarkTheme, DefaultTheme, Stack, ThemeProvider} from "expo-router";
import {StatusBar} from "expo-status-bar";
import React from "react";
import {useFonts} from "expo-font";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {AuthProvider} from "@/src/authentication/AuthContext";
import {PreferencesProvider} from "@/src/preferences/PreferencesContext";
import {AppFontAssets} from "@/src/design/Fonts";
import {ACTIVE_COLOR_SCHEME, Theme} from "@/src/design/Theme";
import {THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {useThemeFollower} from "@/src/design/useThemeFollower";

const BASE_NAVIGATION_THEME = ACTIVE_COLOR_SCHEME === THEME_PREFERENCES.DARK ? DarkTheme : DefaultTheme;

/** Scenes the app does not paint itself (tab pages, transitions) fall back on these colours. */
const NAVIGATION_THEME = {
	...BASE_NAVIGATION_THEME,
	colors: {
		...BASE_NAVIGATION_THEME.colors,
		primary: Theme.colors.ink,
		background: Theme.colors.wash,
		card: Theme.colors.paper,
		text: Theme.colors.ink,
		border: Theme.colors.line
	}
};

export default function RootLayout() {
	const [fontsLoaded, fontError] = useFonts(AppFontAssets);
	useThemeFollower();

	if (!fontsLoaded && !fontError) {
		return null;
	}

	return <GestureHandlerRootView style={{ flex: 1 }}>
		<AuthProvider>
		<PreferencesProvider>
		<ThemeProvider value={NAVIGATION_THEME}>
			<StatusBar hidden />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: Theme.colors.paper },
				}}
			>
				<Stack.Screen name="(protected)" options={{
					headerShown: false,
					animation: "none"
				}} />
				<Stack.Screen name="login" options={{
					animation: "none"
				}}/>
			</Stack>
		</ThemeProvider>
		</PreferencesProvider>
	</AuthProvider>
	</GestureHandlerRootView>;
}