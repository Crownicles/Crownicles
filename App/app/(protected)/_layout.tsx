import {Redirect, Stack} from "expo-router";
import React, {useEffect} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator, Button, Modal, StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AssetsManager} from "@/src/assets/AssetsManager";

export default function RootLayout() {
	const authState = React.useContext(AuthContext);
	const [assetUpdateError, setAssetUpdateError] = React.useState(false);
	const [assetsReady, setAssetsReady] = React.useState(AssetsManager.areAssetsReady());

	useEffect(() => {
		if (!assetsReady) {
			const updateAssets = async () => {
				try {
					await AssetsManager.updateAssets();
					setAssetsReady(true);
				} catch (error) {
					console.error("Failed to update assets:", error);
					setAssetUpdateError(true);
				}
			};
			updateAssets()
					.then();
		}
	}, [assetsReady]);

	const retryAssetUpdate = async () => {
		setAssetUpdateError(false);
		try {
			await AssetsManager.updateAssets();
			setAssetsReady(true);
		} catch (error) {
			console.error("Failed to update assets:", error);
			setAssetUpdateError(true);
		}
	};

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

	if (assetUpdateError) {
		return (
			<Modal visible={true} transparent animationType="fade">
				<View style={styles.overlay} pointerEvents="auto">
					<View style={styles.indicatorContainer}>
						<Text style={{ marginBottom: 16, textAlign: "center" }}>
							Failed to update assets. Please check your internet connection and try again.
						</Text>
						<Button
							title="Retry"
							onPress={retryAssetUpdate}
						/>
					</View>
				</View>
			</Modal>
		);
	}

	if (!assetsReady) {
		return (
			<Modal visible={true} transparent animationType="fade">
				<View style={styles.overlay} pointerEvents="auto">
					<View style={styles.indicatorContainer}>
						<Text style={{ marginBottom: 16, textAlign: "center" }}>
							Updating assets. Please wait...
						</Text>
						<ActivityIndicator size="large" color="#00ff00" />
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
					<Stack screenOptions={{
						headerShown: false,
					}}>
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