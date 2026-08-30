import {ActivityIndicator, Alert, StyleSheet, Text, View} from "react-native";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {useRouter} from "expo-router";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {Theme} from "@/src/design/Theme";
import {Button as DesignButton} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	text: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.hero,
		color: Theme.colors.ink,
	},
	loginIndicator: {
		marginBottom: Theme.spacing.xxl
	},
	loginGap: {
		height: Theme.spacing.xxl
	},
});

type LoginAuthState = React.ContextType<typeof AuthContext>;
type LoginRouter = ReturnType<typeof useRouter>;

function handleExpiredSession(authState: LoginAuthState): void {
	if (authState.state !== AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
		return;
	}

	Alert.alert(i18n.t("app:auth.sessionExpired"));
	authState.setState(AuthStateEnum.NO_TOKEN);
	authState.clearToken().then().catch((err) => {
		console.error("Failed to clear token:", err);
	});
}

async function handleLogin(authState: LoginAuthState, router: LoginRouter): Promise<void> {
	try {
		const keycloakToken = await KeycloakAuth.login();
		const authToken = AuthToken.fromKeycloakOAuth2Token(keycloakToken);

		if (!authToken.getAccessToken()) {
			Alert.alert(i18n.t("app:auth.invalidToken"));
			return;
		}

		authState.saveToken(authToken).then().catch((err) => {
			console.error("Failed to save token:", err);
		});

		await WebSocketClient.getInstance()
			.init(authToken, authState.setState, authState.saveToken)
			.catch((error) => {
				console.error("Failed to initialize WebSocketClient:", error);
				if (authState.state === AuthStateEnum.CONNECTING) {
					authState.setState(AuthStateEnum.CONNECTION_ERROR);
				}
			});
	}
	catch (error) {
		console.error("Login error:", error);
		const message = error instanceof Error ? error.message : i18n.t("app:auth.unknownError");
		Alert.alert(i18n.t("app:auth.loginFailed"), message);
		router.replace("/login");
	}
}

export default function LoginScreen(): React.ReactElement {
	const authState = React.useContext(AuthContext);
	const router = useRouter();

	handleExpiredSession(authState);

	return (
		<View style={styles.container}>
			{authState.state === AuthStateEnum.CONNECTING && (
					<ActivityIndicator size="large" color={Theme.colors.ink} style={styles.loginIndicator} />
			)}
			<Text style={styles.text}>{i18n.t("app:auth.loginTitle")}</Text>
			<View style={styles.loginGap} />
			<DesignButton variant="primary" onPress={() => {
				handleLogin(authState, router).then();
			}}>{i18n.t("app:auth.loginAction")}</DesignButton>
		</View>
	);
}
