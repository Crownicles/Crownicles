import {Redirect, Stack} from "expo-router";
import React, {useEffect} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator, Button, Modal, StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AssetsManager} from "@/src/assets/AssetsManager";

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
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

interface AssetState {
	assetUpdateError: boolean;
	assetsReady: boolean;
	retryAssetUpdate: () => Promise<void>;
}

const ALLOWED_AUTH_STATES: AuthStateEnum[] = [
	AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE,
	AuthStateEnum.RECONNECTING_PACKET_QUEUE,
	AuthStateEnum.LOGGED_IN,
];

async function updateAssets(onReady: () => void, onError: () => void): Promise<void> {
	try {
		await AssetsManager.updateAssets();
		onReady();
	}
	catch (error) {
		console.error("Failed to update assets:", error);
		onError();
	}
}

function useAssetState(): AssetState {
	const [assetUpdateError, setAssetUpdateError] = React.useState(false);
	const [assetsReady, setAssetsReady] = React.useState(AssetsManager.areAssetsReady());

	useEffect((): void => {
		if (assetsReady) {
			return;
		}
		void updateAssets(() => setAssetsReady(true), () => setAssetUpdateError(true));
	}, [assetsReady]);

	const retryAssetUpdate = async (): Promise<void> => {
		setAssetUpdateError(false);
		await updateAssets(() => setAssetsReady(true), () => setAssetUpdateError(true));
	};

	return { assetUpdateError, assetsReady, retryAssetUpdate };
}

function isAuthPending(state: AuthStateEnum): boolean {
	return state === AuthStateEnum.NOT_READY || state === AuthStateEnum.CONNECTING;
}

function renderBlockingState(authState: AuthStateEnum, assetState: AssetState, onReconnect: () => void): React.ReactElement | null {
	if (authState === AuthStateEnum.CONNECTION_ERROR) {
		return (
			<Modal visible transparent animationType="fade">
				<View style={styles.overlay} pointerEvents="auto">
					<View style={styles.indicatorContainer}>
						<Text style={{ marginBottom: 16, textAlign: "center" }}>
							Connection error. Please check your internet connection and try again.
						</Text>
						<Button title="Reconnect" onPress={onReconnect} />
					</View>
				</View>
			</Modal>
		);
	}

	if (assetState.assetUpdateError) {
		return (
			<Modal visible transparent animationType="fade">
				<View style={styles.overlay} pointerEvents="auto">
					<View style={styles.indicatorContainer}>
						<Text style={{ marginBottom: 16, textAlign: "center" }}>
							Failed to update assets. Please check your internet connection and try again.
						</Text>
						<Button title="Retry" onPress={assetState.retryAssetUpdate} />
					</View>
				</View>
			</Modal>
		);
	}

	if (!assetState.assetsReady) {
		return (
			<Modal visible transparent animationType="fade">
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

	return null;
}

function AuthenticatedLayout({ state }: { state: AuthStateEnum }): React.ReactElement {
	return (
		<SafeAreaProvider>
			<View style={{ flex: 1 }}>
				<Stack screenOptions={{
					headerShown: false,
				}}>
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				</Stack>
				{state === AuthStateEnum.RECONNECTING_PACKET_QUEUE && (
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

export default function RootLayout(): React.ReactElement | null {
	const authState = React.useContext(AuthContext);
	const assetState = useAssetState();

	if (isAuthPending(authState.state)) {
		return null;
	}

	const blockingState = renderBlockingState(
		authState.state,
		assetState,
		() => authState.setState(AuthStateEnum.NOT_READY)
	);
	if (blockingState) {
		return blockingState;
	}

	if (!ALLOWED_AUTH_STATES.includes(authState.state)) {
		return <Redirect href="/login" />;
	}

	return <AuthenticatedLayout state={authState.state} />;
}