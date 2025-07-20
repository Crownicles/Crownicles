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

const tokenStorageKey = "auth-token"; // This key is used to store the authentication token in local storage

export function AuthProvider({ children }: PropsWithChildren) {
	const [state, setState] = React.useState(AuthStateEnum.NOT_READY); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const router = useRouter();

	const startAuthenticationFlow = () => {
		SecureStore.getItemAsync(tokenStorageKey).then((result) => {
			if (result) {
				setStateInternal(AuthStateEnum.LOGGED_IN); // todo: check if token is valid and try to connect to websocket server
			} else {
				setStateInternal(AuthStateEnum.NO_TOKEN);
			}
		}).catch((error) => {
			console.error("Failed to load token:", error);
			setStateInternal(AuthStateEnum.NO_TOKEN);
		});
	}

	const setStateInternal = (newState: AuthStateEnum) => {
		setState(newState);

		if (state !== AuthStateEnum.NOT_READY && state !== AuthStateEnum.CONNECTING) {
			SplashScreen.hideAsync(); // Hide the splash screen once the auth state is determined
		}

		if (newState === AuthStateEnum.LOGGED_IN) {
			router.replace("/");
		}
		else if (newState === AuthStateEnum.NO_TOKEN || newState === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
			router.replace("/login");
		}
		else if (newState === AuthStateEnum.NOT_READY) {
			startAuthenticationFlow(); // Restart the authentication flow if the state is not ready (happens when the connection cannot be established)
			router.replace("/");
		}
	}

	const saveToken = async (token: string) => {
		await SecureStore.setItemAsync(tokenStorageKey, token).catch((error) => {
			console.error("Failed to save token:", error);
		});
	}

	const clearToken = async () => {
		await SecureStore.deleteItemAsync(tokenStorageKey).catch((error) => {
			console.error("Failed to clear token:", error);
		});
	}

	useEffect(() => {
		startAuthenticationFlow();
	}, []);

	return (
			<AuthContext.Provider value={{ state, setState: setStateInternal, saveToken, clearToken }}>
				{children}
			</AuthContext.Provider>
	)
}