import React, {PropsWithChildren, useEffect} from "react";
import {SplashScreen, useRouter} from "expo-router";
import * as SecureStore from "expo-secure-store";

SplashScreen.preventAutoHideAsync(); // Prevent the splash screen from hiding until the auth state is determined

export enum AuthStateEnum {
	NOT_READY,
	NO_TOKEN,
	TOKEN_INVALID_OR_EXPIRED,
	CONNECTING,
	RECONNECTING_NO_PACKET_QUEUE,
	RECONNECTING_PACKET_QUEUE,
	CONNECTION_ERROR,
	LOGGED_IN,
}

type AuthState = {
	state: AuthStateEnum;
	setState: (state: AuthStateEnum) => void;
	saveToken: (token: string) => Promise<void>;
	clearToken: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthState>({
	state: AuthStateEnum.NOT_READY,
	setState: () => {
		console.warn("setState called without AuthContext.Provider");
	},
	saveToken: async (token: string) => {
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

		setStateInternal(AuthStateEnum.LOGGED_IN); // todo: check if token is valid and try to connect to websocket server
	}

	const setStateInternal = (newState: AuthStateEnum) => {
		setState(newState);
		console.log("Auth state changed to:", newState);

		if (newState === AuthStateEnum.LOGGED_IN) {
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

	const saveToken = async (token: string) => {
		console.debug("Saving token:", token);

		if (!token || token.length === 0) {
			console.warn("Attempted to save an empty token.");
			return;
		}

		let tokenParts = token.match(/.{1,2048}/g); // Split the token into parts of 2048 characters each

		if (!tokenParts) {
			tokenParts = [token]; // If the token is shorter than 2048 characters, store it as a single part
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