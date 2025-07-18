import {Button, StyleSheet, Text, View} from "react-native";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";

export default function LoginScreen() {
	const authState = React.useContext(AuthContext);

	return (
		<View style={styles.container}>
			<Text style={styles.text}>Login screen</Text>
			<View style={{ height: 24 }} />
			<Button title="Log In" onPress={authState.logIn} />
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
