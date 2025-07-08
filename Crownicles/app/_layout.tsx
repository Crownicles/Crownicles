import {Stack} from "expo-router";

let isLoggedIn = false;

export function setIsLoggedIn(loggedIn: boolean) {
	isLoggedIn = loggedIn;
}

export function AppLayout() {
	return (
			<Stack>
				<Stack.Protected guard={!isLoggedIn}>
					<Stack.Screen name="login" />
				</Stack.Protected>

				<Stack.Protected guard={isLoggedIn}>
					<Stack.Screen name="(app)" />
				</Stack.Protected>
				{/* Expo Router includes all routes by default. Adding Stack.Protected creates exceptions for these screens. */}
			</Stack>
	);
}
