import {Redirect, Stack} from "expo-router";
import React from "react";
import {AuthContext} from "@/src/authentication/AuthContext";

export default function RootLayout() {
	const authState = React.useContext(AuthContext);

	if (!authState.isLoggedIn) {
		return <Redirect href="/login" />;
	}

	return <Stack />;
}
