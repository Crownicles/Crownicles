import { useEffect } from "react";
import {
	AppState, AppStateStatus
} from "react-native";
import { AppPresenceReq } from "ws-packets/src/fromClient/AppPresenceReq";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { WebSocketClient } from "@/src/networking/WebSocketClient";

function announce(state: AppStateStatus): void {
	WebSocketClient.getInstance().sendIfOpen(makeFromClientPacket(AppPresenceReq, { foreground: state === "active" }));
}

/** Tells RestWs whether the player is looking at the app, so their other devices are not pushed what it shows. */
export function useAppPresence(authState: AuthStateEnum): void {
	useEffect(() => {
		if (authState !== AuthStateEnum.LOGGED_IN) {
			return undefined;
		}
		announce(AppState.currentState);
		const subscription = AppState.addEventListener("change", announce);
		return (): void => subscription.remove();
	}, [authState]);
}
