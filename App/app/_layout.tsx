import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import React from "react";
import {AuthProvider} from "@/src/authentication/AuthContext";

export default function RootLayout() {
	return <AuthProvider>
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
	</AuthProvider>;
}