import type * as FatalErrorStoreModule from "@/src/store/FatalErrorStore";

const mockStorage = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
	getItem: (key: string): string | null => mockStorage.get(key) ?? null,
	setItem: (key: string, value: string): void => {
		mockStorage.set(key, value);
	}
}));
jest.mock("expo-application", () => ({
	nativeApplicationVersion: "6.0.4", nativeBuildVersion: "3"
}));

/** A new launch of the app: the store is loaded again and only knows what the phone kept. */
function launchApp(): typeof FatalErrorStoreModule {
	let loaded: typeof FatalErrorStoreModule | undefined;
	jest.isolateModules(() => {
		loaded = jest.requireActual<typeof FatalErrorStoreModule>("@/src/store/FatalErrorStore");
	});
	return loaded!;
}

function setDevelopmentBuild(development: boolean): void {
	Reflect.set(globalThis, "__DEV__", development);
}

function fightError(): TypeError {
	const error = new TypeError("Cannot read property 'isSelf' of undefined");
	error.stack = "TypeError: Cannot read property 'isSelf' of undefined\n    at FightStage (FightStage.tsx:65:30)\n    at FightTurn (FightBattle.tsx:98:4)";
	return error;
}

describe("fatal error store", () => {
	const reactNativeHandler = jest.fn();
	const developmentBuild = __DEV__;

	beforeEach(() => {
		mockStorage.clear();
		reactNativeHandler.mockClear();
		ErrorUtils.setGlobalHandler(reactNativeHandler);
	});

	afterEach(() => setDevelopmentBuild(developmentBuild));

	it("keeps the message and the stack of an error that closes the app, for the next launch to hand over", () => {
		launchApp().installFatalErrorHandler();

		ErrorUtils.getGlobalHandler()(fightError(), true);

		const report = launchApp().fatalErrorStore.getLast();
		expect(report).toMatchObject({
			message: "TypeError: Cannot read property 'isSelf' of undefined",
			appVersion: "6.0.4",
			appBuild: "3"
		});
		expect(report?.stack).toContain("at FightStage (FightStage.tsx:65:30)");
	});

	it("shows the error screen instead of closing a release build", () => {
		setDevelopmentBuild(false);
		const {
			fatalErrorStore, installFatalErrorHandler
		} = launchApp();
		installFatalErrorHandler();
		const screen = jest.fn();
		fatalErrorStore.subscribeRaised(screen);
		const error = fightError();

		ErrorUtils.getGlobalHandler()(error, true);

		expect(reactNativeHandler).not.toHaveBeenCalled();
		expect(screen).toHaveBeenCalled();
		expect(fatalErrorStore.getRaised()).toBe(error);
	});

	it("still closes a release build when no screen is there yet to show the error, once it is kept", () => {
		setDevelopmentBuild(false);
		const {
			fatalErrorStore, installFatalErrorHandler
		} = launchApp();
		installFatalErrorHandler();
		const error = fightError();

		ErrorUtils.getGlobalHandler()(error, true);

		expect(reactNativeHandler).toHaveBeenCalledWith(error, true);
		expect(fatalErrorStore.getLast()?.message).toBe("TypeError: Cannot read property 'isSelf' of undefined");
	});

	it("leaves an error that does not close the app to React Native, without keeping it", () => {
		const {
			fatalErrorStore, installFatalErrorHandler
		} = launchApp();
		installFatalErrorHandler();
		const warning = new Error("A request failed");

		ErrorUtils.getGlobalHandler()(warning, false);

		expect(reactNativeHandler).toHaveBeenCalledWith(warning, false);
		expect(fatalErrorStore.getLast()).toBeNull();
	});

	it("keeps no credential in a report that leaves the phone, even when the error quotes the socket address", () => {
		const accessToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJwbGF5ZXIifQ.c2lnbmF0dXJl";
		const address = `wss://crownicles.example.com/ws?protocol=3&token=${accessToken}`;
		const error = new Error(`Unable to open ${address}`);
		error.stack = `Error: Unable to open ${address}\n    at connect (WebSocketClient.ts:253:18)`;
		launchApp().installFatalErrorHandler();

		ErrorUtils.getGlobalHandler()(error, true);

		const report = launchApp().fatalErrorStore.getLast();
		expect(mockStorage.get("lastFatalError")).not.toContain(accessToken);
		expect(report?.message).toContain("wss://crownicles.example.com/ws?protocol=3");
		expect(report?.stack).toContain("at connect (WebSocketClient.ts:253:18)");
		expect(launchApp().describeFatalError("refresh_token=opaque-refresh&client_id=app Bearer opaque-access").message)
			.not.toMatch(/opaque-refresh|opaque-access/);
	});

	it("keeps a report short enough to be stored and shared, whatever the error says", () => {
		const payload = "x".repeat(100_000);
		launchApp().installFatalErrorHandler();

		ErrorUtils.getGlobalHandler()(new Error(payload), true);

		expect(launchApp().fatalErrorStore.getLast()?.message.length).toBeLessThan(payload.length);
	});
});
