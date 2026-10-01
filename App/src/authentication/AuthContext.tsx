import React, {PropsWithChildren, useEffect} from "react";
import {useRouter} from "expo-router";
import {deleteStoredToken, readFullStoredToken, readStoredToken, TOKEN_STORAGE_KEY_TEMPLATE, writeStoredToken} from "@/src/authentication/TokenStorage";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {reportEventStore} from "@/src/collectors/ReportEventStore";
import {fightStore} from "@/src/store/FightStore";

type AuthState = {
	state: AuthStateEnum;
	setState: (state: AuthStateEnum) => void;
	saveToken: (token: AuthToken) => Promise<void>;
	clearToken: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthState>({
	state: AuthStateEnum.NOT_READY,
	setState: () => {
		console.warn("setState called without AuthContext.Provider");
	},
	saveToken: (_token: AuthToken): Promise<void> => {
		console.warn("saveToken called without AuthContext.Provider");
		return Promise.resolve();
	},
	clearToken: (): Promise<void> => {
		console.warn("clearToken called without AuthContext.Provider");
		return Promise.resolve();
	}
});

export function AuthProvider({ children }: PropsWithChildren): React.ReactElement {
	const [state, setState] = React.useState(AuthStateEnum.NOT_READY); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const currentState = React.useRef(state);
	const tokenEdits = React.useRef<Promise<void>>(Promise.resolve());
	const router = useRouter();
	const initialNavigationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelPendingNavigation = (): void => {
		if (initialNavigationTimer.current !== null) {
			clearTimeout(initialNavigationTimer.current);
			initialNavigationTimer.current = null;
		}
	};

	const navigateToAuthenticatedRoot = (): void => {
		cancelPendingNavigation();

		// AuthProvider is mounted just above the root navigator. A direct replace from the first
		// websocket callback can therefore run before Expo Router has mounted its navigation ref.
		// Defer it briefly and retry while the root is mounting instead of crashing the app with
		// "Attempted to navigate before mounting the Root Layout component".
		const attempt = (): void => {
			try {
				router.replace("/");
				initialNavigationTimer.current = null;
			}
			catch (error) {
				console.warn("Root navigator is not ready yet; retrying authenticated navigation:", error);
				initialNavigationTimer.current = setTimeout(attempt, 100);
			}
		};
		initialNavigationTimer.current = setTimeout(attempt, 100);
	};

	const clearStoredToken = async (): Promise<void> => {
		let shouldContinue = true;
		let count = 1;
		while (shouldContinue) {
			const tokenStorageKey = `${TOKEN_STORAGE_KEY_TEMPLATE}${count}`;
			count++;
			const result = await readStoredToken(tokenStorageKey);
			if (result) {
				await deleteStoredToken(tokenStorageKey);
			}
			else {
				shouldContinue = false; // Stop if no more token parts are found
			}
		}
	}

	const runTokenEdit = (edit: () => Promise<void>): Promise<void> => {
		const done = tokenEdits.current.then(edit);
		tokenEdits.current = done.catch((): void => undefined);
		return done;
	};

	const clearToken = (): Promise<void> => runTokenEdit(clearStoredToken);

	const saveToken = (token: AuthToken): Promise<void> => runTokenEdit(async (): Promise<void> => {
		console.debug("Saving token");

		if (!token) {
			console.warn("Attempted to save an empty token.");
			return;
		}

		await clearStoredToken();

		const tokenString = token.toJsonString();

		let tokenParts = tokenString.match(/.{1,2048}/g); // Split the token into parts of 2048 characters each

		if (!tokenParts) {
			tokenParts = [tokenString]; // If the token is shorter than 2048 characters, store it as a single part
		}

		for (let i = 0; i < tokenParts.length; i++) {
			const tokenStorageKey = `${TOKEN_STORAGE_KEY_TEMPLATE}${i + 1}`;
			await writeStoredToken(tokenStorageKey, tokenParts[i]);
		}
	});

	const startAuthenticationFlow = async (onStateChange: (newState: AuthStateEnum) => void): Promise<void> => {
		const token = await readFullStoredToken().catch((error) => {
			console.error("Failed to load token:", error);
			return "";
		});

		if (!token || token.length === 0) {
			console.log("No token found, setting state to NO_TOKEN");
			onStateChange(AuthStateEnum.NO_TOKEN);
			return;
		}

		const authToken = AuthToken.fromJsonString(token);
		if (await authToken.refreshIfNeeded()) {
			console.debug("Token refreshed successfully");
			await saveToken(authToken); // Save the refreshed token
		}

		await WebSocketClient.getInstance().init(authToken, onStateChange, saveToken).catch((error) => {
			console.error("Failed to initialize WebSocketClient:", error);
			if (currentState.current === AuthStateEnum.CONNECTING) {
				onStateChange(AuthStateEnum.CONNECTION_ERROR);
			}
		});
	}

	const setStateInternal = (newState: AuthStateEnum): void => {
		const previousState = currentState.current;
		currentState.current = newState;
		const isInitialLogin = newState === AuthStateEnum.LOGGED_IN
			&& previousState !== AuthStateEnum.LOGGED_IN
			&& previousState !== AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE
			&& previousState !== AuthStateEnum.RECONNECTING_PACKET_QUEUE;
		const shouldRedirectToLogin = newState === AuthStateEnum.NO_TOKEN || newState === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED;
		const shouldRestartAuthentication = newState === AuthStateEnum.NOT_READY;

		setState(newState);
		console.log("Auth state changed from", previousState, "to", newState);

		if (isInitialLogin) {
			navigateToAuthenticatedRoot();
		}
		else if (shouldRedirectToLogin) {
			WebSocketClient.getInstance().disconnect();
			cancelPendingNavigation();
			collectorsStore.reset();
			reportEventStore.reset();
			fightStore.reset();
			router.replace("/login");
		}
		else if (shouldRestartAuthentication) {
			startAuthenticationFlow(setStateInternal).then().catch(err => {
				console.error("Error during authentication flow restart:", err);
				setStateInternal(AuthStateEnum.NO_TOKEN);
			}); // Restart the authentication flow if the state is not ready (happens when the connection cannot be established)
			router.replace("/");
		}
	}

	useEffect(() => {
		startAuthenticationFlow(setStateInternal)
			.then().catch((error) => {
				console.error("Error during authentication flow:", error);
				setStateInternal(AuthStateEnum.NO_TOKEN);
			});
	}, []);

	useEffect(() => cancelPendingNavigation, []);

	return (
			<AuthContext.Provider value={{ state, setState: setStateInternal, saveToken, clearToken }}>
				{children}
			</AuthContext.Provider>
	)
}
