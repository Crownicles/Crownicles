import {Button, StyleSheet, Text, View} from "react-native";
import React from "react";
import {AuthContext, AuthStateEnum} from "@/src/authentication/AuthContext";

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
				authState.setState(AuthStateEnum.LOGGED_IN);
				authState.saveToken("dummy-token").then().catch((err) => {
					console.error("Failed to save token:", err);
				}); // todo: replace with actual token logic
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
