import React, {PropsWithChildren, useEffect} from "react";
import {SplashScreen, useRouter} from "expo-router";
import {deleteItemAsync, getItemAsync, setItemAsync} from "expo-secure-store";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

SplashScreen.preventAutoHideAsync(); // Prevent the splash screen from hiding until the auth state is determined

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

const tokenStorageKeyTemplate = "auth-token-"; // This key is used to store the authentication token in local storage

export function AuthProvider({ children }: PropsWithChildren): React.ReactElement {
	const [state, setState] = React.useState(AuthStateEnum.NOT_READY); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const router = useRouter();
	const initialNavigationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const navigateToAuthenticatedRoot = (): void => {
		if (initialNavigationTimer.current !== null) {
			clearTimeout(initialNavigationTimer.current);
		}

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

	const clearToken = async (): Promise<void> => {
		let shouldContinue = true;
		let count = 1;
		while (shouldContinue) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${count}`;
			count++;
			const result = await getItemAsync(tokenStorageKey).catch((error) => {
				console.error("Failed to load token for clearing:", error);
				return null;
			});
			if (result) {
				await deleteItemAsync(tokenStorageKey).catch((error) => {
					console.error("Failed to clear token part:", error);
				});
			}
			else {
				shouldContinue = false; // Stop if no more token parts are found
			}
		}
	}

	const saveToken = async (token: AuthToken): Promise<void> => {
		console.debug("Saving token:", token);

		if (!token) {
			console.warn("Attempted to save an empty token.");
			return;
		}

		await clearToken();

		const tokenString = token.toJsonString();

		let tokenParts = tokenString.match(/.{1,2048}/g); // Split the token into parts of 2048 characters each

		if (!tokenParts) {
			tokenParts = [tokenString]; // If the token is shorter than 2048 characters, store it as a single part
		}

		for (let i = 0; i < tokenParts.length; i++) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${i + 1}`;
			await setItemAsync(tokenStorageKey, tokenParts[i]).catch((error) => {
				console.error("Failed to save token part:", error);
			});
		}
	}

	const startAuthenticationFlow = async (onStateChange: (newState: AuthStateEnum) => void): Promise<void> => {
		// The token is stored in multiple parts because the Expo SecureStore has a limit on the size of the stored item.
		let shouldContinue = true;
		let count = 1;
		let token = "";
		while (shouldContinue) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${count}`;
			count++;
			const result = await getItemAsync(tokenStorageKey).catch((error) => {
				console.error("Failed to load token:", error);
				onStateChange(AuthStateEnum.NO_TOKEN);
			});
			if (result) {
				token += result; // Append the token part to the full token
			}
			else {
				shouldContinue = false; // Stop if no more token parts are found
			}
		}

		console.debug("Loaded token:", token);

		if (!token || token.length === 0) {
			console.log("No token found, setting state to NO_TOKEN");
			onStateChange(AuthStateEnum.NO_TOKEN);
			return;
		}

		const authToken = AuthToken.fromJsonString(token);
		if (await authToken.refreshIfNeeded()) {
			console.debug("Token refreshed successfully:", authToken);
			await saveToken(authToken); // Save the refreshed token
		}

		await WebSocketClient.getInstance().init(authToken, onStateChange, saveToken).catch((error) => {
			console.error("Failed to initialize WebSocketClient:", error);
			if (state === AuthStateEnum.CONNECTING) {
				onStateChange(AuthStateEnum.CONNECTION_ERROR);
			}
		});
	}

	const setStateInternal = (newState: AuthStateEnum): void => {
		const previousState = state;
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

	useEffect(() => (): void => {
		if (initialNavigationTimer.current !== null) {
			clearTimeout(initialNavigationTimer.current);
		}
	}, []);

	useEffect(() => {
		if (state !== AuthStateEnum.NOT_READY && state !== AuthStateEnum.CONNECTING) {
			SplashScreen.hideAsync(); // Hide the splash screen once the auth state is determined
		}
	}, [state]);

	return (
			<AuthContext.Provider value={{ state, setState: setStateInternal, saveToken, clearToken }}>
				{children}
			</AuthContext.Provider>
	)
}
