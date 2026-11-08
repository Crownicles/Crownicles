import { ReactNode } from "react";
import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import {
	Share, Text
} from "react-native";
import { Try } from "expo-router/build/views/Try";
import {
	FatalErrorRelay, FatalErrorScreen
} from "@/src/components/FatalErrorScreen";
import { fatalErrorStore } from "@/src/store/FatalErrorStore";

jest.mock("expo-secure-store", () => ({
	getItem: (): null => null, setItem: jest.fn()
}));
jest.mock("@/src/translations/i18n", () => ({
	i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key }
}));

const broken = { screen: true };

/** A fight screen reading a fighter the server did not send, until it is fixed. */
function FightScreen(): ReactNode {
	if (broken.screen) {
		throw new TypeError("Cannot read property 'isSelf' of undefined");
	}
	return <Text>fight</Text>;
}

/** The root layout as Expo Router mounts it: its error boundary around the whole app. */
function App({ children }: { children: ReactNode }): ReactNode {
	return <Try catch={FatalErrorScreen}><FatalErrorRelay />{children}</Try>;
}

describe("fatal error screen", () => {
	beforeEach(() => {
		broken.screen = true;
		jest.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it("keeps the app open on a screen that broke while drawing, and hands its report over", async () => {
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
		await render(<App><FightScreen /></App>);

		expect(screen.getByText("app:crash.title")).toBeTruthy();
		expect(screen.getByText("TypeError: Cannot read property 'isSelf' of undefined")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:crash.share"));

		const report = share.mock.calls[0][0].message;
		expect(report).toContain("Cannot read property 'isSelf' of undefined");
		expect(report).toContain("FightScreen");
	});

	it("starts the app again from the error screen", async () => {
		await render(<App><FightScreen /></App>);
		broken.screen = false;

		await fireEvent.press(screen.getByText("app:crash.restart"));

		expect(screen.getByText("fight")).toBeTruthy();
		expect(screen.queryByText("app:crash.title")).toBeNull();
	});

	it("shows an error thrown outside of any screen instead of letting it close the app", async () => {
		broken.screen = false;
		await render(<App><FightScreen /></App>);

		await act(() => {
			fatalErrorStore.raise(new Error("A fight animation callback failed"));
		});

		expect(screen.getByText("Error: A fight animation callback failed")).toBeTruthy();
		expect(fatalErrorStore.raise(new Error("Another callback failed meanwhile"))).toBe(true);
		await fireEvent.press(screen.getByText("app:crash.restart"));
		expect(screen.getByText("fight")).toBeTruthy();
	});
});
