import {
	Alert, StyleSheet, View
} from "react-native";
import {Image} from "expo-image";
import React from "react";
import crowniclesLogo from "@/assets/images/icon.png";
import {AuthContext} from "@/src/authentication/AuthContext";
import {
	IDENTITY_PROVIDERS, KeycloakAuth, type IdentityProvider
} from "@/src/authentication/KeycloakAuth";
import {
	AUTH_FAILURES, reasonOfUnknownError
} from "@/src/authentication/AuthFailure";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {useRouter} from "expo-router";
import {useTranslationsReady} from "@/src/translations/useTranslationsReady";
import {Theme} from "@/src/design/Theme";
import {Screen} from "@/src/design/Primitives";
import {
	ActionBanner, Standing
} from "@/src/design/Sections";
import {
	AtSign, MessageCircle, UserPlus
} from "@/src/design/FightIcons";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	screen: {
		flexGrow: 1,
		justifyContent: "center"
	},
	emblem: {
		width: 64,
		height: 64,
		borderRadius: 8
	},
	choices: {
		gap: Theme.spacing.md,
		marginTop: Theme.spacing.xl
	}
});

type LoginAuthState = React.ContextType<typeof AuthContext>;

function handleExpiredSession(authState: LoginAuthState): void {
	if (authState.state !== AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
		return;
	}

	Alert.alert(i18n.t("app:auth.sessionExpired"));
	authState.setState(AuthStateEnum.NO_TOKEN);
	authState.clearToken().catch((error: unknown) => {
		console.error("Failed to clear token:", error);
	});
}

async function handleLogin(authState: LoginAuthState, identityProvider?: IdentityProvider): Promise<void> {
	try {
		const authToken = AuthToken.fromKeycloakOAuth2Token(await KeycloakAuth.login(identityProvider));

		authState.saveToken(authToken).catch((error: unknown) => {
			console.error("Failed to save token:", error);
		});

		await WebSocketClient.getInstance()
			.init(authToken, authState.setState, authState.saveToken)
			.catch((error: unknown) => {
				console.error("Failed to initialize WebSocketClient:", error);
				if (authState.state === AuthStateEnum.CONNECTING) {
					authState.setState(AuthStateEnum.CONNECTION_ERROR);
				}
			});
	}
	catch (error) {
		const reason = reasonOfUnknownError(error);

		// Backing out of the browser is a decision the player already knows they made.
		if (reason === AUTH_FAILURES.CANCELLED) {
			return;
		}

		console.error("Login error:", error);
		Alert.alert(i18n.t("app:auth.loginFailed"), i18n.t(`app:auth.failures.${reason}`));
	}
}

export default function LoginScreen(): React.ReactElement {
	const authState = React.useContext(AuthContext);
	const connecting = authState.state === AuthStateEnum.CONNECTING;
	const router = useRouter();

	useTranslationsReady();
	handleExpiredSession(authState);

	const start = (identityProvider?: IdentityProvider): void => {
		handleLogin(authState, identityProvider).catch((error: unknown) => {
			console.error("Login error:", error);
		});
	};

	return (
		<Screen contentContainerStyle={styles.screen}>
			<Standing
				emblem={<Image source={crowniclesLogo} style={styles.emblem} contentFit="cover" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
				caption={i18n.t("app:auth.caption")}
				title={i18n.t("app:auth.title")}
			/>
			<View style={styles.choices}>
				<ActionBanner
					icon={MessageCircle}
					label={connecting ? i18n.t("app:auth.connecting") : i18n.t("app:auth.withDiscord")}
					pending={connecting}
					onPress={(): void => {
						start(IDENTITY_PROVIDERS.DISCORD);
					}}
					testID="login-discord"
				/>
				<ActionBanner
					icon={AtSign}
					label={i18n.t("app:auth.withAccount")}
					pending={connecting}
					onPress={(): void => {
						start();
					}}
					testID="login-account"
				/>
				<ActionBanner
					icon={UserPlus}
					label={i18n.t("app:auth.createAccount")}
					pending={connecting}
					onPress={(): void => {
						router.push("/register");
					}}
					testID="login-register"
				/>
			</View>
		</Screen>
	);
}
