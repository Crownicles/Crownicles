import {Button, StyleSheet, Text, View} from "react-native";
import React from "react";
import {AuthContext, AuthStateEnum} from "@/src/authentication/AuthContext";
import {RestApi} from "@/src/networking/RestApi";

export default function LoginScreen() {
	const authState = React.useContext(AuthContext);

	// If auth state is token invalid or expired, we show a popup message to the user
	if (authState.state === AuthStateEnum.TOKEN_INVALID_OR_EXPIRED) {
		alert("Your session has expired. Please log in again.");
		authState.setState(AuthStateEnum.NO_TOKEN);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.text}>Login screen</Text>
			<View style={{ height: 24 }} />
			<Button title="Log In" onPress={() => {
				RestApi.loginWithDiscord().then((result) => {
					if (result.type === "success") {
						let token = result.url.split('token=')[1];
						if (!token) {
							alert("Login failed. No token received.");
							return;
						}

						// Handle successful login, e.g., save token and update auth state
						authState.setState(AuthStateEnum.LOGGED_IN);
						authState.saveToken(token).then().catch((err) => {
							console.error("Failed to save token:", err);
						});
					} else {
						alert("Login failed. Please try again.");
					}
				}).catch((error) => {
					console.error("Login error:", error);
					alert("An error occurred during login. Please try again.");
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
