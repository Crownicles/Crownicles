import {act, render, screen, fireEvent, waitFor} from "@testing-library/react-native";
import {ReactElement} from "react";
import {Animated, PanResponder, PanResponderCallbacks, PanResponderGestureState, StyleSheet, Text} from "react-native";
import {BottomSheet, SheetScrollView, sheetDragStarts} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";

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
		{label: "sideways with a downward drift", gesture: drag({dx: 12, dy: 16}), scroll: 0, expected: false},
		{label: "upward", gesture: drag({dy: -120}), scroll: 0, expected: false},
		{label: "pinch", gesture: drag({numberActiveTouches: 2}), scroll: 0, expected: false},
		{label: "still scrolled", gesture: drag(), scroll: 100, expected: false},
		{label: "tiny movement", gesture: drag({dy: 2}), scroll: 0, expected: false}
	])("only takes over an eligible $label drag", ({gesture, scroll, expected}) => {
		expect(sheetDragStarts(gesture, scroll)).toBe(expected);
	});

	it("takes a touch that starts on its header, which the native window would otherwise keep from every later move", async () => {
		await render(<BottomSheet onClose={jest.fn()} heading={<Text>Acquérir ce logis</Text>}><Text>Content</Text></BottomSheet>);
		expect(responders[0].onStartShouldSetPanResponder?.(undefined as never, drag({dy: 0}))).toBe(true);
	});

	it("closes from the content when it was already at the top", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		const content = responders[1];
		content.onStartShouldSetPanResponderCapture?.(undefined as never, drag());
		expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(true);
		content.onPanResponderRelease?.(undefined as never, drag());
		await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
	});

	it("slides down out of sight before its owner removes it", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		const spring = jest.spyOn(Animated, "spring");
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
		expect(close).not.toHaveBeenCalled();
		expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({toValue: expect.any(Number), overshootClamping: true}));
		await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
	});

	it("keeps the finger's momentum when a flick closes it", async () => {
		await render(<BottomSheet onClose={jest.fn()}><Text>Content</Text></BottomSheet>);
		const spring = jest.spyOn(Animated, "spring");
		responders[0].onPanResponderRelease?.(undefined as never, drag({dy: 30, vy: 1.2}));
		expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({velocity: 1200}));
	});

	it.each([
		{label: "open", visible: true, claims: false},
		{label: "put away", visible: false, claims: true}
	])("leaves the edge swipe of the page underneath to a sheet $label", async ({visible, claims}) => {
		await render(<SwipeBack onClose={jest.fn()}><BottomSheet onClose={jest.fn()} visible={visible}><Text>Content</Text></BottomSheet></SwipeBack>);
		const edgeSwipe = drag({x0: 10, dx: 60, dy: 0});
		expect(responders[0].onMoveShouldSetPanResponderCapture?.(undefined as never, edgeSwipe)).toBe(claims);
	});

	it("stays open when a drag taken over ends up as a sideways swipe", async () => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		responders[1].onPanResponderGrant?.(undefined as never, drag());
		responders[1].onPanResponderRelease?.(undefined as never, drag({dx: 220, dy: 60, vy: 1.5}));
		await act(async () => undefined);
		expect(close).not.toHaveBeenCalled();
	});

	it("comes back up when its owner keeps it open, instead of lingering off screen", async () => {
		jest.useFakeTimers();
		await render(<BottomSheet onClose={jest.fn()}><Text>Content</Text></BottomSheet>);
		await fireEvent.press(screen.getByTestId("detail-sheet-backdrop"));
		const spring = jest.spyOn(Animated, "spring");
		await act(async () => jest.advanceTimersByTime(5_000));
		expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({toValue: 0}));
		jest.useRealTimers();
	});

	it.each([
		{label: "pulled past the top", offset: -90, closes: 1},
		{label: "barely bounced", offset: -20, closes: 0},
		{label: "scrolled inside", offset: 150, closes: 0}
	])("closes when the content is released $label only if pulled far enough", async ({offset, closes}) => {
		const close = jest.fn();
		await render(<BottomSheet onClose={close}><Text>Content</Text></BottomSheet>);
		await fireEvent(screen.getByText("Content"), "scrollEndDrag", {nativeEvent: {contentOffset: {x: 0, y: offset}}});
		await waitFor(() => expect(close).toHaveBeenCalledTimes(closes));
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
		await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
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

	describe("with a scroller of its own, like the fight journal", () => {
		const journal = (close: () => void, startAtEnd = false): ReactElement => <BottomSheet onClose={close} heading={<Text>Journal</Text>}>
			<SheetScrollView startAtEnd={startAtEnd} testID="journal"><Text>Turn 1</Text></SheetScrollView>
		</BottomSheet>;

		it("reads back a journal scrolled halfway instead of closing, while its header still takes it away", async () => {
			const close = jest.fn();
			await render(journal(close));
			await fireEvent.scroll(screen.getByTestId("journal"), {nativeEvent: {contentOffset: {x: 0, y: 400}}});
			const [header, content] = responders;
			content.onStartShouldSetPanResponderCapture?.(undefined as never, drag({dy: 0}));
			expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(false);

			expect(header.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(true);
			header.onPanResponderRelease?.(undefined as never, drag());
			await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
		});

		it("counts a journal opened on its latest lines as scrolled", async () => {
			await render(journal(jest.fn(), true));
			const scroller = screen.getByTestId("journal");
			await fireEvent(scroller, "layout", {nativeEvent: {layout: {x: 0, y: 0, width: 320, height: 300}}});
			await fireEvent(scroller, "contentSizeChange", 320, 1_200);
			const content = responders[1];
			content.onStartShouldSetPanResponderCapture?.(undefined as never, drag({dy: 0}));
			expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(false);
		});

		it("still closes from the journal once it is back at its top when the drag starts", async () => {
			await render(journal(jest.fn()));
			const scroller = screen.getByTestId("journal");
			await fireEvent.scroll(scroller, {nativeEvent: {contentOffset: {x: 0, y: 400}}});
			await fireEvent.scroll(scroller, {nativeEvent: {contentOffset: {x: 0, y: 0}}});
			const content = responders[1];
			content.onStartShouldSetPanResponderCapture?.(undefined as never, drag({dy: 0}));
			expect(content.onMoveShouldSetPanResponderCapture?.(undefined as never, drag())).toBe(true);
		});
	});
});