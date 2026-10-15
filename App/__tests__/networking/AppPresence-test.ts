import { renderHook } from "@testing-library/react-native";
import {
	AppState, AppStateStatus
} from "react-native";
import { AppPresenceReq } from "ws-packets/src/fromClient/AppPresenceReq";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import { useAppPresence } from "@/src/networking/AppPresence";

describe("app presence", () => {
	const originalState = AppState.currentState;
	let sent: jest.SpyInstance;
	let listeners: ((state: AppStateStatus) => void)[];
	let removed: jest.Mock;

	beforeEach(() => {
		listeners = [];
		removed = jest.fn();
		sent = jest.spyOn(WebSocketClient.getInstance(), "sendIfOpen").mockImplementation(() => undefined);
		jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
			listeners.push(listener);
			return { remove: removed };
		});
		Reflect.set(AppState, "currentState", "active");
	});

	afterEach(() => {
		Reflect.set(AppState, "currentState", originalState);
		jest.restoreAllMocks();
	});

	function announced(): boolean[] {
		return sent.mock.calls.map(([packet]) => {
			expect(packet).toBeInstanceOf(AppPresenceReq);
			return (packet as AppPresenceReq).foreground;
		});
	}

	it("tells the server the app is in front of the player once connected, then follows the app state", async () => {
		await renderHook(() => useAppPresence(AuthStateEnum.LOGGED_IN));
		listeners.forEach(listener => listener("background"));
		listeners.forEach(listener => listener("active"));
		expect(announced()).toEqual([true, false, true]);
	});

	it("says nothing while disconnected, and tells the current state again on reconnection", async () => {
		const hook = await renderHook(({ authState }: { authState: AuthStateEnum }) => useAppPresence(authState), { initialProps: { authState: AuthStateEnum.LOGGED_IN } });
		await hook.rerender({ authState: AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE });
		expect(removed).toHaveBeenCalledTimes(1);
		Reflect.set(AppState, "currentState", "background");
		await hook.rerender({ authState: AuthStateEnum.LOGGED_IN });
		expect(announced()).toEqual([true, false]);
	});
});
