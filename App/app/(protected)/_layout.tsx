import {Redirect, Stack} from "expo-router";
import React, {useEffect} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator, Modal, StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {Theme} from "@/src/design/Theme";
import {Button as DesignButton} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: Theme.colors.overlay,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 9999,
	},
	indicatorContainer: {
		backgroundColor: Theme.colors.paper,
		borderRadius: Theme.radius,
		padding: Theme.spacing.xxl,
		elevation: 4,
	},
	blockingText: {
		fontFamily: Theme.fonts.regular,
		marginBottom: Theme.spacing.md,
		textAlign: "center"
	},
	authenticatedRoot: {
		flex: 1
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
		updateAssets(() => setAssetsReady(true), () => setAssetUpdateError(true)).catch((error) => {
			console.error("Failed to update assets state:", error);
		});
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
						<Text style={styles.blockingText}>
							{i18n.t("app:common.connectionError")}
						</Text>
						<DesignButton variant="primary" onPress={onReconnect}>{i18n.t("app:common.reconnect")}</DesignButton>
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
						<Text style={styles.blockingText}>
							{i18n.t("app:common.assetsUpdateError")}
						</Text>
						<DesignButton variant="primary" onPress={assetState.retryAssetUpdate}>{i18n.t("app:common.retry")}</DesignButton>
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
						<Text style={styles.blockingText}>
							{i18n.t("app:common.assetsUpdating")}
						</Text>
						<ActivityIndicator size="large" color={Theme.colors.ink} />
					</View>
				</View>
			</Modal>
		);
	}

	return null;
}

function ReconnectingOverlay(): React.ReactElement {
	return (
		<View style={styles.overlay} pointerEvents="auto">
			<View style={styles.indicatorContainer}>
				<ActivityIndicator size="large" color={Theme.colors.ink} />
			</View>
		</View>
	);
}

function AuthenticatedLayout({ state }: { state: AuthStateEnum }): React.ReactElement {
	return (
		<SafeAreaProvider>
			<View style={styles.authenticatedRoot}>
				<Stack screenOptions={{
					headerShown: false,
				}}>
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				</Stack>
				{state === AuthStateEnum.RECONNECTING_PACKET_QUEUE && (
					<ReconnectingOverlay />
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
