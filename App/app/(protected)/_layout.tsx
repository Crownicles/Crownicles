import {Redirect, Stack} from "expo-router";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator, Modal, StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {Theme} from "@/src/design/Theme";
import {Button as DesignButton} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";
import {CollectorsProvider} from "@/src/collectors/CollectorsContext";
import {OpenCollectors} from "@/src/collectors/OpenCollectors";

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
		color: Theme.colors.ink,
		marginBottom: Theme.spacing.md,
		textAlign: "center"
	},
	authenticatedRoot: {
		flex: 1
	},
});

const ALLOWED_AUTH_STATES: AuthStateEnum[] = [
	AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE,
	AuthStateEnum.RECONNECTING_PACKET_QUEUE,
	AuthStateEnum.LOGGED_IN,
];

function isAuthPending(state: AuthStateEnum): boolean {
	return state === AuthStateEnum.NOT_READY || state === AuthStateEnum.CONNECTING;
}

/** A protocol mismatch cannot be retried away when the app is the one behind: the notice has no button then. */
const OUTDATED_NOTICES: Partial<Record<AuthStateEnum, {message: string; canRetry: boolean}>> = {
	[AuthStateEnum.APP_OUTDATED]: {message: "app:boot.appOutdated", canRetry: false},
	[AuthStateEnum.SERVER_OUTDATED]: {message: "app:boot.serverOutdated", canRetry: true}
};

function BlockingNotice({message, onRetry}: {message: string; onRetry?: () => void}): React.ReactElement {
	return (
		<Modal visible transparent animationType="fade">
			<View style={styles.overlay} pointerEvents="auto">
				<View style={styles.indicatorContainer}>
					<Text style={styles.blockingText}>{message}</Text>
					{onRetry ? <DesignButton variant="primary" onPress={onRetry}>{i18n.t("app:common.reconnect")}</DesignButton> : null}
				</View>
			</View>
		</Modal>
	);
}

function renderBlockingState(authState: AuthStateEnum, onReconnect: () => void): React.ReactElement | null {
	if (authState === AuthStateEnum.CONNECTION_ERROR) {
		return <BlockingNotice message={i18n.t("app:common.connectionError")} onRetry={onReconnect} />;
	}
	const outdated = OUTDATED_NOTICES[authState];
	if (outdated) {
		return <BlockingNotice message={i18n.t(outdated.message)} {...outdated.canRetry ? {onRetry: onReconnect} : {}} />;
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

function AuthenticatedContent({ state }: { state: AuthStateEnum }): React.ReactElement {
	return (
		<View style={styles.authenticatedRoot}>
			<Stack screenOptions={{headerShown: false}}>
				<Stack.Screen name="(tabs)" options={{headerShown: false}} />
			</Stack>
			{state === AuthStateEnum.RECONNECTING_PACKET_QUEUE && <ReconnectingOverlay />}
			<OpenCollectors />
		</View>
	);
}

function AuthenticatedLayout({ state }: { state: AuthStateEnum }): React.ReactElement {
	return (
		<SafeAreaProvider>
			<GameQueryProvider authState={state}>
				<CollectorsProvider authState={state}>
					<AuthenticatedContent state={state} />
				</CollectorsProvider>
			</GameQueryProvider>
		</SafeAreaProvider>
	);
}

export default function RootLayout(): React.ReactElement | null {
	const authState = React.useContext(AuthContext);

	if (isAuthPending(authState.state)) {
		return null;
	}

	const blockingState = renderBlockingState(
		authState.state,
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
