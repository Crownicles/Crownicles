import {
	StyleSheet, View
} from "react-native";
import {Image} from "expo-image";
import React, {useEffect, useState} from "react";
import crowniclesLogo from "@/assets/images/icon.png";
import {AuthContext} from "@/src/authentication/AuthContext";
import {
	IDENTITY_PROVIDERS, KeycloakAuth
} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";
import {
	AUTH_FAILURES, reasonOfUnknownError
} from "@/src/authentication/AuthFailure";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {Theme} from "@/src/design/Theme";
import {Note, Screen} from "@/src/design/Primitives";
import {
	ActionBanner, Refusal, Standing
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

/** Why the player is on this screen again, said on the screen itself rather than in a system alert. */
type LoginNotice = {title: string; detail?: string};

/** An expired session sends the player back here: the screen says why, then forgets the dead token. */
function useExpiredSession(authState: LoginAuthState, onExpired: (notice: LoginNotice) => void): void {
	const {state, setState, clearToken} = authState;
	useEffect(() => {
		if (state !== AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
			return;
		}
		onExpired({title: i18n.t("app:auth.sessionExpired")});
		setState(AuthStateEnum.NO_TOKEN);
		clearToken().catch((error: unknown) => {
			console.error("Failed to clear token:", error);
		});
	}, [state, setState, clearToken, onExpired]);
}

async function handleLogin(authState: LoginAuthState, authorize: () => Promise<KeycloakOAuth2Token>, onRefused: (notice: LoginNotice) => void): Promise<void> {
	try {
		const authToken = AuthToken.fromKeycloakOAuth2Token(await authorize());

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
		onRefused({title: i18n.t("app:auth.loginFailed"), detail: i18n.t(`app:auth.failures.${reason}`)});
	}
}

export default function LoginScreen(): React.ReactElement {
	const authState = React.useContext(AuthContext);
	const connecting = authState.state === AuthStateEnum.CONNECTING;
	const [notice, setNotice] = useState<LoginNotice | null>(null);

	useExpiredSession(authState, setNotice);

	const start = (authorize: () => Promise<KeycloakOAuth2Token>): void => {
		setNotice(null);
		handleLogin(authState, authorize, setNotice).catch((error: unknown) => {
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
			{notice ? <Refusal>{notice.title}</Refusal> : null}
			{notice?.detail ? <Note>{notice.detail}</Note> : null}
			<View style={styles.choices}>
				<ActionBanner
					icon={MessageCircle}
					label={connecting ? i18n.t("app:auth.connecting") : i18n.t("app:auth.withDiscord")}
					pending={connecting}
					onPress={(): void => {
						start(() => KeycloakAuth.login(IDENTITY_PROVIDERS.DISCORD));
					}}
					testID="login-discord"
				/>
				<ActionBanner
					icon={AtSign}
					label={i18n.t("app:auth.withAccount")}
					pending={connecting}
					onPress={(): void => {
						start(() => KeycloakAuth.login());
					}}
					testID="login-account"
				/>
				<ActionBanner
					icon={UserPlus}
					label={i18n.t("app:auth.createAccount")}
					pending={connecting}
					onPress={(): void => {
						start(() => KeycloakAuth.register());
					}}
					testID="login-register"
				/>
			</View>
		</Screen>
	);
}
