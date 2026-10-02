import {render, screen, fireEvent} from "@testing-library/react-native";
import {Animated, PanResponder, PanResponderCallbacks, PanResponderGestureState, StyleSheet, Text} from "react-native";
import {BottomSheet, sheetDragStarts} from "@/src/design/Sections";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

function drag(update: Partial<PanResponderGestureState> = {}): PanResponderGestureState {
	return {stateID: 1, moveX: 0, moveY: 0, x0: 0, y0: 0, dx: 0, dy: 120, vx: 0, vy: 0, numberActiveTouches: 1, _accountsForMovesUpTo: 0, ...update};
}

describe("bottom sheet dismissal", () => {
	let responders: PanResponderCallbacks[];
	beforeEach(() => {
		responders = [];
		const create = PanResponder.create;
		jest.spyOn(PanResponder, "create").mockImplementation(config => {
			responders.push(config);
			return create(config);
		});
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([
		{label: "downward", gesture: drag(), scroll: 0, expected: true},
		{label: "horizontal", gesture: drag({dx: 180}), scroll: 0, expected: false},
		{label: "upward", gesture: drag({dy: -120}), scroll: 0, expected: false},
		{label: "pinch", gesture: drag({numberActiveTouches: 2}), scroll: 0, expected: false},
		{label: "still scrolled", gesture: drag(), scroll: 100, expected: false},
		{label: "tiny movement", gesture: drag({dy: 2}), scroll: 0, expected: false}
	])("only takes over an eligible $label drag", ({gesture, scroll, expected}) => {
		expect(sheetDragStarts(gesture, scroll)).toBe(expected);
	});

	it("closes from the content when it was already at the top", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		const content = responders[1];
		content.onStartShouldSetPanResponderCapture?.(undefined as never, drag());
		expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(true);
		content.onPanResponderRelease?.(undefined as never, drag());
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("lets the content scroll without jumping into dismissal halfway through the same touch", async () => {
		await render(<BottomSheet onClose={jest.fn()}><Text>Content</Text></BottomSheet>);
		await fireEvent.scroll(screen.getByText("Content"), {nativeEvent: {contentOffset: {x: 0, y: 100}}});
		const content = responders[1];
		content.onStartShouldSetPanResponderCapture?.(undefined as never, drag());
		await fireEvent.scroll(screen.getByText("Content"), {nativeEvent: {contentOffset: {x: 0, y: 0}}});
		expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(false);
		expect(responders[0].onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(true);
	});

	it("springs back on a short drag or cancellation without closing", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		const spring = jest.spyOn(Animated, "spring");
		responders[0].onPanResponderRelease?.(undefined as never, drag({dy: 30, vy: 0.1}));
		responders[0].onPanResponderTerminate?.(undefined as never, drag());
		expect(close).not.toHaveBeenCalled();
		expect(spring).toHaveBeenCalledTimes(2);
	});

	it("closes on a short downward flick and provides a full-height grab area", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		expect(StyleSheet.flatten(screen.getByTestId("bottom-sheet-handle").props.style).minHeight).toBeGreaterThanOrEqual(44);
		responders[0].onPanResponderRelease?.(undefined as never, drag({dy: 30, vy: 1}));
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("does not close when a second finger interrupts an already active drag", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		const header = responders[0];
		header.onPanResponderGrant?.(undefined as never, drag());
		header.onPanResponderMove?.(undefined as never, drag({dy: 100, numberActiveTouches: 2}));
		header.onPanResponderRelease?.(undefined as never, drag({dy: 120, vy: 1}));
		expect(close).not.toHaveBeenCalled();
	});
});