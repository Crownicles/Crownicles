import {Redirect, Stack} from "expo-router";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator, Button, Modal, StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

export default function RootLayout() {
	const authState = React.useContext(AuthContext);

	if (
			authState.state === AuthStateEnum.NOT_READY ||
			authState.state === AuthStateEnum.CONNECTING
	) {
		return null;
	}

	if (authState.state === AuthStateEnum.CONNECTION_ERROR) {
		return (
			<Modal visible={true} transparent animationType="fade">
				<View style={styles.overlay} pointerEvents="auto">
					<View style={styles.indicatorContainer}>
						<Text style={{ marginBottom: 16, textAlign: "center" }}>
							Connection error. Please check your internet connection and try again.
						</Text>
						<Button
							title="Reconnect"
							onPress={() => authState.setState(AuthStateEnum.NOT_READY)}
						/>
					</View>
				</View>
			</Modal>
		);
	}

	const allowedStates = [
		AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE,
		AuthStateEnum.RECONNECTING_PACKET_QUEUE,
		AuthStateEnum.LOGGED_IN,
	];
	if (!allowedStates.includes(authState.state)) {
		return <Redirect href="/login" />;
	}

	return (
			<SafeAreaProvider>
				<View style={{ flex: 1 }}>
					<Stack>
						<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
					</Stack>
					{authState.state === AuthStateEnum.RECONNECTING_PACKET_QUEUE && (
							<View style={styles.overlay} pointerEvents="auto">
								<View style={styles.indicatorContainer}>
									<ActivityIndicator size="large" color="#00ff00" />
								</View>
							</View>
					)}
				</View>
			</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "center",
		alignItems: "center",
		zIndex: 9999,
	},
	indicatorContainer: {
		backgroundColor: "#fff",
		borderRadius: 12,
		padding: 24,
		elevation: 4,
	},
});