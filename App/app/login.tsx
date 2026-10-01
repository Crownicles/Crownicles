import {
	StyleSheet, View
} from "react-native";
import {Image} from "expo-image";
import React, {useEffect, useRef, useState} from "react";
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
import {Button, Note, Screen} from "@/src/design/Primitives";
import {
	ActionBanner, Refusal, Standing
} from "@/src/design/Sections";
import {
	AtSign, MessageCircle, UserPlus
} from "@/src/design/FightIcons";
import {i18n} from "@/src/translations/i18n";
import {RestApi} from "@/src/networking/RestApi";
import {AccountCollisionLoginState, AccountCollisionScreen} from "@/src/authentication/AccountCollisionScreen";
import {readFullStoredToken} from "@/src/authentication/TokenStorage";

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
type Authorize = () => Promise<KeycloakOAuth2Token>;

const LOGIN_ENTRIES = {
	WELCOME: "welcome",
	DISCORD: "discord",
	ACCOUNT: "account"
} as const;

type LoginEntry = typeof LOGIN_ENTRIES[keyof typeof LOGIN_ENTRIES];

type LoginChoicesProps = {
	entry: LoginEntry;
	connecting: boolean;
	onChoose: (entry: LoginEntry) => void;
	onAuthorize: (authorize: Authorize) => void;
};

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
		clearToken().catch((error: unknown) => {
			console.error("Failed to clear token:", error);
		}).finally((): void => setState(AuthStateEnum.NO_TOKEN));
	}, [state, setState, clearToken, onExpired]);
}

async function connectAuthenticatedAccount(authState: LoginAuthState, authToken: AuthToken): Promise<void> {
	await authState.saveToken(authToken);
	await WebSocketClient.getInstance().init(authToken, authState.setState, authState.saveToken);
}

async function handleLogin(authState: LoginAuthState, authorize: Authorize, onRefused: (notice: LoginNotice) => void, onCollision: (state: AccountCollisionLoginState) => void): Promise<void> {
	try {
		const authToken = AuthToken.fromKeycloakOAuth2Token(await authorize());
		const collision = await RestApi.checkAccountCollision(authToken.getAccessToken() ?? "");
		if (collision.collision || collision.pending) {
			onCollision({token: authToken, check: collision});
			return;
		}
		await connectAuthenticatedAccount(authState, authToken);
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

function LoginChoices({entry, connecting, onChoose, onAuthorize}: LoginChoicesProps): React.ReactElement {
	if (entry === LOGIN_ENTRIES.WELCOME) {
		return <>
			<ActionBanner icon={UserPlus} label={i18n.t("app:auth.createAccount")} pending={connecting} onPress={(): void => onAuthorize(() => KeycloakAuth.register())} testID="login-register" />
			<Button disabled={connecting} onPress={(): void => onChoose(LOGIN_ENTRIES.ACCOUNT)}>{i18n.t("app:auth.alreadyHaveAccount")}</Button>
		</>;
	}
	if (entry === LOGIN_ENTRIES.DISCORD) {
		return <ActionBanner
			icon={MessageCircle}
			label={connecting ? i18n.t("app:auth.connecting") : i18n.t("app:auth.withDiscord")}
			pending={connecting}
			onPress={(): void => onAuthorize(() => KeycloakAuth.login(IDENTITY_PROVIDERS.DISCORD))}
			testID="login-discord"
		/>;
	}
	return <>
		<ActionBanner icon={AtSign} label={i18n.t("app:auth.withAccount")} pending={connecting} onPress={(): void => onAuthorize(() => KeycloakAuth.login())} testID="login-account" />
		<Button disabled={connecting} onPress={(): void => onChoose(LOGIN_ENTRIES.DISCORD)}>{i18n.t("app:auth.withDiscord")}</Button>
	</>;
}

export default function LoginScreen(): React.ReactElement {
	const authState = React.useContext(AuthContext);
	const [authorizing, setAuthorizing] = useState(false);
	const authorizationPending = useRef(false);
	const connecting = authorizing || authState.state === AuthStateEnum.CONNECTING || authState.state === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED;
	const [notice, setNotice] = useState<LoginNotice | null>(null);
	const [entry, setEntry] = useState<LoginEntry>(authState.state === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED ? LOGIN_ENTRIES.ACCOUNT : LOGIN_ENTRIES.WELCOME);
	const [collision, setCollision] = useState<AccountCollisionLoginState | null>(null);

	useExpiredSession(authState, setNotice);
	useEffect(() => {
		if (authState.state !== AuthStateEnum.ACCOUNT_COLLISION) return;
		readFullStoredToken().then(async (stored): Promise<void> => {
			const token = AuthToken.fromJsonString(stored);
			const check = await RestApi.checkAccountCollision(token.getAccessToken() ?? "");
			setCollision({token, check});
		}).catch((error: unknown): void => {
			setNotice({title: i18n.t("app:auth.loginFailed"), detail: i18n.t("app:auth.collision.errors.unavailable")});
			console.warn("Could not restore account collision", error);
		});
	}, [authState.state]);

	const start = (authorize: Authorize): void => {
		if (authorizationPending.current || connecting) return;
		authorizationPending.current = true;
		setAuthorizing(true);
		setNotice(null);
		handleLogin(authState, authorize, setNotice, setCollision).catch((error: unknown) => {
			console.error("Login error:", error);
		}).finally((): void => {
			authorizationPending.current = false;
			setAuthorizing(false);
		});
	};
	const chooseEntry = (chosenEntry: LoginEntry): void => {
		setEntry(chosenEntry);
		if (chosenEntry === LOGIN_ENTRIES.DISCORD) start(() => KeycloakAuth.login(IDENTITY_PROVIDERS.DISCORD));
	};

	if (collision) return <AccountCollisionScreen state={collision} onAuthenticated={(token): Promise<void> => connectAuthenticatedAccount(authState, token)} onCancel={(): void => {
		setCollision(null);
		setEntry(LOGIN_ENTRIES.WELCOME);
		authState.clearToken().then(() => authState.setState(AuthStateEnum.NO_TOKEN)).catch((error: unknown) => console.warn("Could not leave collision", error));
	}} />;

	return (
		<Screen contentContainerStyle={styles.screen}>
			<Standing
				emblem={<Image source={crowniclesLogo} style={styles.emblem} contentFit="cover" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
				caption={i18n.t(entry === LOGIN_ENTRIES.WELCOME ? "app:auth.caption" : "app:auth.title")}
				title={i18n.t(entry === LOGIN_ENTRIES.WELCOME ? "app:auth.title" : "app:auth.loginTitle")}
				subtitle={i18n.t(entry === LOGIN_ENTRIES.WELCOME ? "app:auth.welcome" : "app:auth.chooseAccount")}
			/>
			{notice ? <Refusal>{notice.title}</Refusal> : null}
			{notice?.detail ? <Note>{notice.detail}</Note> : null}
			<View style={styles.choices}>
				<LoginChoices entry={entry} connecting={connecting} onChoose={chooseEntry} onAuthorize={start} />
				{entry !== LOGIN_ENTRIES.WELCOME ? <Button disabled={connecting} onPress={(): void => {
					setNotice(null);
					setEntry(LOGIN_ENTRIES.WELCOME);
				}}>{i18n.t("app:common.back")}</Button> : null}
			</View>
		</Screen>
	);
}
