import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import React from "react";
import {useFonts} from "expo-font";
import {AuthProvider} from "@/src/authentication/AuthContext";
import {PreferencesProvider} from "@/src/preferences/PreferencesContext";
import {AppFontAssets} from "@/src/design/Fonts";
import {Theme} from "@/src/design/Theme";

export default function RootLayout() {
	const [fontsLoaded, fontError] = useFonts(AppFontAssets);

	if (!fontsLoaded && !fontError) {
		return null;
	}

	return <AuthProvider>
		<PreferencesProvider>
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
		</PreferencesProvider>
	</AuthProvider>;
}