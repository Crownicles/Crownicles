import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import React from "react";
import {AuthProvider} from "@/src/authentication/AuthContext";
import {PreferencesProvider} from "@/src/preferences/PreferencesContext";

export default function RootLayout() {
	return <AuthProvider>
		<PreferencesProvider>
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: "white" },
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