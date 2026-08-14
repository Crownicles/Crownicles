import {ActivityIndicator, Button, StyleSheet, Text, View} from "react-native";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthToken} from "@/src/authentication/AuthToken";
import {useRouter} from "expo-router";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

export default function LoginScreen() {
	const authState = React.useContext(AuthContext);
	const router = useRouter();

	// If auth state is token invalid or expired, we show a popup message to the user
	if (authState.state === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
		alert("Your session has expired. Please log in again.");
		authState.setState(AuthStateEnum.NO_TOKEN);
		authState.clearToken().then().catch((err) => {
			console.error("Failed to clear token:", err);
		});
	}

	return (
		<View style={styles.container}>
			{authState.state === AuthStateEnum.CONNECTING && (
					<ActivityIndicator size="large" color="#00ff00" style={{ marginBottom: 24 }} />
			)}
			<Text style={styles.text}>Login screen</Text>
			<View style={{ height: 24 }} />
			<Button title="Log In" onPress={() => {
				KeycloakAuth.login().then(async (keycloakToken) => {
					const authToken = AuthToken.fromKeycloakOAuth2Token(keycloakToken);

					if (!authToken.getAccessToken()) {
						alert("Login failed. Invalid token received.");
						return;
					}

					// Handle successful login, save the token and initialize WebSocketClient
					authState.saveToken(authToken)
							.then()
							.catch((err) => {
								console.error("Failed to save token:", err);
							});

					await WebSocketClient.getInstance()
							.init(authToken, authState.setState, authState.saveToken)
							.catch((error) => {
								console.error("Failed to initialize WebSocketClient:", error);
								if (authState.state === AuthStateEnum.CONNECTING) {
									authState.setState(AuthStateEnum.CONNECTION_ERROR);
								}
							});
				}).catch((error) => {
					console.error("Login error:", error);
					alert("An error occurred during login. Please try again.");
					router.replace("/login");
				});
			}} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	text: {
		fontSize: 24,
		fontWeight: "bold",
	},
});
