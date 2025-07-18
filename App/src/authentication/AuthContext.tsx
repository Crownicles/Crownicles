import React, {PropsWithChildren} from "react";
import {useRouter} from "expo-router";

type AuthState = {
	isLoggedIn: boolean;
	logIn: () => void;
	logOut: () => void;
}

export const AuthContext = React.createContext<AuthState>({
	isLoggedIn: false,
	logIn: () => {},
	logOut: () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
	const [isLoggedIn, setIsLoggedIn] = React.useState(false); // Persist state: https://youtu.be/yNaOaR2kIa0?t=649
	const router = useRouter();

	const logIn = () => {
		setIsLoggedIn(true);
		router.replace("/");
	}

	const logOut = () => {
		setIsLoggedIn(false);
		router.replace("/login");
	}

	return (
			<AuthContext.Provider value={{ isLoggedIn, logIn, logOut }}>
				{children}
			</AuthContext.Provider>
	)
}