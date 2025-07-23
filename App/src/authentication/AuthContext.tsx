import React, {PropsWithChildren, useEffect} from "react";
import {SplashScreen, useRouter} from "expo-router";
import * as SecureStore from "expo-secure-store";
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
	saveToken: async (_token: AuthToken) => {
		console.warn("saveToken called without AuthContext.Provider");
	},
	clearToken: async () => {
		console.warn("clearToken called without AuthContext.Provider");
	}
});

const tokenStorageKeyTemplate = "auth-token-"; // This key is used to store the authentication token in local storage

export function AuthProvider({ children }: PropsWithChildren) {
	const [state, setState] = React.useState(AuthStateEnum.NOT_READY); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const router = useRouter();

	const setStateInternal = (newState: AuthStateEnum) => {
		const previousState = state;

		setState(newState);
		console.log("Auth state changed from", previousState, "to", newState);

		if (newState === AuthStateEnum.LOGGED_IN && previousState !== AuthStateEnum.LOGGED_IN && previousState !== AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE && previousState !== AuthStateEnum.RECONNECTING_PACKET_QUEUE) {
			router.replace("/");
		}
		else if (newState === AuthStateEnum.NO_TOKEN || newState === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
			router.replace("/login");
		}
		else if (newState === AuthStateEnum.NOT_READY) {
			startAuthenticationFlow().then().catch(err => {
				console.error("Error during authentication flow restart:", err);
				setStateInternal(AuthStateEnum.NO_TOKEN);
			}); // Restart the authentication flow if the state is not ready (happens when the connection cannot be established)
			router.replace("/");
		}
	}

	const saveToken = async (token: AuthToken) => {
		console.debug("Saving token:", token);

		if (!token) {
			console.warn("Attempted to save an empty token.");
			return;
		}

		await clearToken();

		let tokenString = token.toJsonString();

		let tokenParts = tokenString.match(/.{1,2048}/g); // Split the token into parts of 2048 characters each

		if (!tokenParts) {
			tokenParts = [tokenString]; // If the token is shorter than 2048 characters, store it as a single part
		}

		for (let i = 0; i < tokenParts.length; i++) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${i + 1}`;
			await SecureStore.setItemAsync(tokenStorageKey, tokenParts[i]).catch((error) => {
				console.error("Failed to save token part:", error);
			});
		}
	}

	const clearToken = async () => {
		let shouldContinue = true;
		let count = 1;
		while (shouldContinue) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${count}`;
			count++;
			let result = await SecureStore.getItemAsync(tokenStorageKey).catch((error) => {
				console.error("Failed to load token for clearing:", error);
				return null;
			});
			if (result) {
				await SecureStore.deleteItemAsync(tokenStorageKey).catch((error) => {
					console.error("Failed to clear token part:", error);
				});
			}
			else {
				shouldContinue = false; // Stop if no more token parts are found
			}
		}
	}

	const startAuthenticationFlow = async () => {
		// The token is stored in multiple parts because the Expo SecureStore has a limit on the size of the stored item.
		let shouldContinue = true;
		let count = 1;
		let token = "";
		while (shouldContinue) {
			const tokenStorageKey = `${tokenStorageKeyTemplate}${count}`;
			count++;
			let result = await SecureStore.getItemAsync(tokenStorageKey).catch((error) => {
				console.error("Failed to load token:", error);
				setStateInternal(AuthStateEnum.NO_TOKEN);
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
			setStateInternal(AuthStateEnum.NO_TOKEN);
			return;
		}

		let authToken = AuthToken.fromJsonString(token);
		if (await authToken.refreshIfNeeded()) {
			console.debug("Token refreshed successfully:", authToken);
			await saveToken(authToken); // Save the refreshed token
		}

		await WebSocketClient.getInstance().init(authToken, setStateInternal, saveToken).catch((error) => {
			console.error("Failed to initialize WebSocketClient:", error);
			if (state === AuthStateEnum.CONNECTING) {
				setStateInternal(AuthStateEnum.CONNECTION_ERROR);
			}
		});
	}

	useEffect(() => {
		startAuthenticationFlow()
				.then ().catch((error) => {
					console.error("Error during authentication flow:", error);
					setStateInternal(AuthStateEnum.NO_TOKEN);
				});
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