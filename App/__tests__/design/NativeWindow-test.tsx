import {ReactNode} from "react";
import {act, render, screen} from "@testing-library/react-native";
import {AppState, AppStateStatus, ModalProps, Text} from "react-native";

// The setup replaces the windows by plain modals for every other test.
const {NativeWindow} = jest.requireActual<typeof import("@/src/design/NativeWindow")>("@/src/design/NativeWindow");

/** The windows listen to the app state from their import on: the test plays the platform's part. */
const appStateListeners = jest.mocked(AppState.addEventListener).mock.calls
	.filter(([type]) => type === "change")
	.map(([, listener]) => listener as (state: AppStateStatus) => void);

async function setAppState(state: AppStateStatus): Promise<void> {
	Object.defineProperty(AppState, "currentState", {value: state, configurable: true});
	await act(async () => appStateListeners.forEach(listener => listener(state)));
}

/** The platform calls the window back once its animation is over. */
async function report(callback: (() => void) | undefined): Promise<void> {
	await act(async () => callback?.());
}

/** The native window holding a content, reached through the props the test renderer kept on it. */
function windowOf(testID: string): ModalProps {
	let node = screen.getByTestId(testID).parent;
	while (node && !("onShow" in node.props)) node = node.parent;
	if (!node) throw new Error(`No window around ${testID}`);
	return node.props as ModalProps;
}

function Windows({first, second, onFirstDismissed}: {first: boolean; second: boolean; onFirstDismissed?: () => void}): ReactNode {
	return <>
		<NativeWindow visible={first} {...onFirstDismissed ? {onDismiss: onFirstDismissed} : {}}><Text testID="first">first</Text></NativeWindow>
		<NativeWindow visible={second}><Text testID="second">second</Text></NativeWindow>
	</>;
}

describe("native windows", () => {
	beforeAll(() => jest.useFakeTimers());
	afterAll(() => jest.useRealTimers());

	beforeEach(async () => {
		// A window removed by the previous test is still leaving: let it go first.
		await act(async () => jest.runOnlyPendingTimers());
		await setAppState("active");
	});

	it("waits for the app to be active, as when it wakes up from a notification", async () => {
		await setAppState("background");
		await render(<Windows first second={false} />);
		expect(screen.queryByTestId("first")).toBeNull();

		await setAppState("inactive");
		expect(screen.queryByTestId("first")).toBeNull();
		await setAppState("active");
		expect(screen.getByTestId("first")).toBeTruthy();
	});

	it("opens one window at a time, the next once the first has appeared", async () => {
		await render(<Windows first second />);
		expect(screen.getByTestId("first")).toBeTruthy();
		expect(screen.queryByTestId("second")).toBeNull();

		await report(() => windowOf("first").onShow?.({} as never));
		expect(screen.getByTestId("second")).toBeTruthy();
		expect(screen.getByTestId("first")).toBeTruthy();
	});

	it("does not open a window while another one leaves", async () => {
		const view = await render(<Windows first second={false} />);
		const first = windowOf("first");
		await report(() => first.onShow?.({} as never));

		await view.rerender(<Windows first={false} second />);
		expect(screen.queryByTestId("second")).toBeNull();

		await report(first.onDismiss);
		expect(screen.getByTestId("second")).toBeTruthy();
	});

	it("keeps a window on screen when the app leaves the foreground", async () => {
		await render(<Windows first second={false} />);
		await report(() => windowOf("first").onShow?.({} as never));
		await setAppState("inactive");
		expect(screen.getByTestId("first")).toBeTruthy();
	});

	it("reports a window withdrawn before it ever appeared as dismissed, so what waits for it goes on", async () => {
		await setAppState("background");
		const onDismissed = jest.fn();
		const view = await render(<Windows first second={false} onFirstDismissed={onDismissed} />);
		await view.rerender(<Windows first={false} second={false} onFirstDismissed={onDismissed} />);
		expect(onDismissed).toHaveBeenCalledTimes(1);
	});

	it("stops waiting for a platform that never reports the first window", async () => {
		await render(<Windows first second />);
		expect(screen.queryByTestId("second")).toBeNull();

		await act(async () => jest.advanceTimersByTime(1_000));
		expect(screen.getByTestId("second")).toBeTruthy();
	});
});
