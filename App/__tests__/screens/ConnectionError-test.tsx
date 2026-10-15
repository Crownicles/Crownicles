import type { ReactNode } from "react";
import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import RootLayout from "@/app/(protected)/_layout";
import { AuthContext } from "@/src/authentication/AuthContext";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { fakeAuthState } from "@/src/testing/fakeAuthState";

jest.mock("expo-router", () => ({
	Redirect: (): null => null, Stack: Object.assign((): null => null, { Screen: (): null => null })
}));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string): string => key } }));
jest.mock("@/src/store/GameQueryProvider", () => ({ GameQueryProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/src/collectors/CollectorsContext", () => ({ CollectorsProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/src/collectors/OpenCollectors", () => ({ OpenCollectors: (): null => null }));
jest.mock("@/src/components/ConnectionStatus", () => ({ ConnectionStatus: (): null => null }));
jest.mock("@/src/gameServices/GameServicesLifecycle", () => ({ GameServicesLifecycle: (): null => null }));

describe("blocking connection notice", () => {
	it("lets the player try again or leave a session that cannot reach the game", async () => {
		const auth = fakeAuthState({ state: AuthStateEnum.CONNECTION_ERROR });
		await render(<AuthContext.Provider value={auth}><RootLayout /></AuthContext.Provider>);
		expect(screen.getByText("app:common.connectionError")).toBeTruthy();

		await fireEvent.press(screen.getByText("app:common.reconnect"));
		expect(auth.retry).toHaveBeenCalledTimes(1);
		expect(auth.leave).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByText("app:common.logout"));
		expect(auth.leave).toHaveBeenCalledTimes(1);
	});
});
