import {DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider} from "expo-router";
import {StatusBar} from "expo-status-bar";
import React, {ReactNode, useMemo} from "react";
import {useFonts} from "expo-font";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {AuthProvider} from "@/src/authentication/AuthContext";
import {PreferencesProvider} from "@/src/preferences/PreferencesContext";
import {AppFontAssets} from "@/src/design/Fonts";
import {THEME_PREFERENCES} from "@/src/design/ThemePreference";
import {BootGate} from "@/src/translations/BootGate";
import {ThemeRoot, useColors, useTheme} from "@/src/design/ThemeContext";

SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
	console.warn("Unable to keep the native splash screen visible:", error);
});

/** Scenes the app does not paint itself (tab pages, transitions) fall back on these colours. */
function useNavigationTheme(): typeof DefaultTheme {
	const {scheme, colors} = useTheme();
	return useMemo(() => {
		const base = scheme === THEME_PREFERENCES.DARK ? DarkTheme : DefaultTheme;
		return {
			...base,
			colors: {
				...base.colors,
				primary: colors.ink,
				background: colors.wash,
				card: colors.paper,
				text: colors.ink,
				border: colors.line
			}
		};
	}, [scheme, colors]);
}

/** What needs the translations: the signed-in session and the player's preferences. */
function SessionProviders({children}: {children: ReactNode}): ReactNode {
	return <AuthProvider>
		<PreferencesProvider>{children}</PreferencesProvider>
	</AuthProvider>;
}

function AppProviders({children}: {children: ReactNode}): ReactNode {
	return <GestureHandlerRootView style={{ flex: 1 }}>
		<ThemeProvider value={useNavigationTheme()}>
			<BootGate>
				<SessionProviders>{children}</SessionProviders>
			</BootGate>
		</ThemeProvider>
	</GestureHandlerRootView>;
}

function ThemedApp(): ReactNode {
	const colors = useColors();
	const [fontsLoaded, fontError] = useFonts(AppFontAssets);
	React.useEffect((): void => {
		if (fontsLoaded || fontError) {
			SplashScreen.hideAsync().catch((error: unknown) => {
				console.warn("Unable to hide the native splash screen:", error);
			});
		}
	}, [fontsLoaded, fontError]);

	if (!fontsLoaded && !fontError) {
		return null;
	}

	return <AppProviders>
		<StatusBar hidden />
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.paper },
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
	</AppProviders>;
}

export default function RootLayout(): ReactNode {
	return <ThemeRoot><ThemedApp /></ThemeRoot>;
}