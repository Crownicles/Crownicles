import {SplashScreen} from "expo-router";
import {WebSocketClient, WebSocketClientState} from "@/src/networking/WebSocketClient.ts";

export function SplashScreenController() {
	if (WebSocketClient.getInstance().getState() !== WebSocketClientState.CONNECTING) {
		SplashScreen.hideAsync();
	}

	return null;
}
