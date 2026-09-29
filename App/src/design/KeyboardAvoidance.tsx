import {
	createContext, ReactNode, RefObject, useCallback, useContext, useEffect, useRef, useState
} from "react";
import {
	Keyboard, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, TextInput, View
} from "react-native";
import {Theme} from "@/src/design/Theme";

/** Space kept between what must stay in sight and the top of the keyboard. */
const REVEAL_MARGIN = Theme.spacing.lg;

/** Lets the scroll view settle (iOS caret scroll, Android shortening) before it is measured. */
const SETTLE_DELAY_MS = 80;

/** A vertical span in window coordinates. */
export type WindowSpan = {top: number; bottom: number};

type Measurable = Pick<View, "measureInWindow">;
type RevealRequest = {field: Measurable; form: Measurable};
type Reveal = (request: RevealRequest) => void;

const RevealContext = createContext<Reveal | null>(null);
const FormContext = createContext<RefObject<View | null> | null>(null);

/**
 * How far to scroll down so a whole form (field, refusal reason, button) sits above the keyboard,
 * without pushing the field being typed in off the top of the visible area.
 */
export function revealOffset(form: WindowSpan, field: WindowSpan, visible: WindowSpan): number {
	const hidden = form.bottom + REVEAL_MARGIN - visible.bottom;
	const room = field.top - visible.top - REVEAL_MARGIN;
	return Math.max(0, Math.min(hidden, room));
}

function spanOf(target: Measurable): Promise<WindowSpan> {
	return new Promise(resolve => {
		target.measureInWindow((_x, y, _width, height) => resolve({top: y, bottom: y + height}));
	});
}

/** What must stay in sight together while one of its fields is typed in: the fields and the action that sends them. */
export function FormBlock({children}: {children: ReactNode}): ReactNode {
	const ref = useRef<View>(null);
	return <FormContext.Provider value={ref}><View ref={ref}>{children}</View></FormContext.Provider>;
}

/** Asks the screen, once focused, to bring the field's form above the keyboard; alone, the field and its hint. */
export function useRevealOnFocus(): {inputRef: RefObject<TextInput | null>; rootRef: RefObject<View | null>; onFocus: () => void} {
	const reveal = useContext(RevealContext);
	const form = useContext(FormContext);
	const inputRef = useRef<TextInput>(null);
	const rootRef = useRef<View>(null);
	const onFocus = (): void => {
		const field = inputRef.current;
		const block = form?.current ?? rootRef.current;
		if (reveal && field && block) reveal({field, form: block});
	};
	return {inputRef, rootRef, onFocus};
}

type KeyboardAvoidance = {
	scrollRef: RefObject<ScrollView | null>;

	/** Height to take off the scroll view on Android, where the edge-to-edge window no longer shrinks. */
	clearance: number;
	onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
	reveal: Reveal;
};

/**
 * Keeps what the player types in, and what they need next, above the keyboard.
 *
 * iOS insets the scroll view natively (`automaticallyAdjustKeyboardInsets`) and Android gets it shortened
 * by `clearance`; both only bring the caret into sight, so the rest of the form is scrolled up here.
 */
export function useKeyboardAvoidance(): KeyboardAvoidance {
	const scrollRef = useRef<ScrollView>(null);
	const [clearance, setClearance] = useState(0);
	const applied = useRef(0);
	const offset = useRef(0);
	const keyboardTop = useRef<number | null>(null);
	const request = useRef<RevealRequest | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const settleThenReveal = useCallback((): void => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			const target = request.current;
			const scroll = scrollRef.current?.getNativeScrollRef();
			const top = keyboardTop.current;
			if (!target || !scroll || top === null) return;
			Promise.all([spanOf(scroll), spanOf(target.form), spanOf(target.field)]).then(([viewport, form, field]) => {
				const delta = revealOffset(form, field, {top: viewport.top, bottom: Math.min(viewport.bottom, top)});
				if (delta > 0) scrollRef.current?.scrollTo({y: offset.current + delta, animated: true});
			}).catch(console.warn);
		}, SETTLE_DELAY_MS);
	}, []);

	useEffect(() => {
		const apply = (value: number): void => {
			applied.current = value;
			setClearance(value);
		};
		const shown = Keyboard.addListener("keyboardDidShow", ({endCoordinates}) => {
			keyboardTop.current = endCoordinates.screenY;
			if (Platform.OS === "android") {
				scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
					// Android re-emits the event when the keyboard changes height: measure from where the view would end unshortened.
					apply(Math.max(0, y + height + applied.current - endCoordinates.screenY));
				});
			}
			settleThenReveal();
		});
		const hidden = Keyboard.addListener("keyboardDidHide", () => {
			keyboardTop.current = null;
			request.current = null;
			if (Platform.OS === "android") apply(0);
		});
		return (): void => {
			shown.remove();
			hidden.remove();
			if (timer.current) clearTimeout(timer.current);
		};
	}, [settleThenReveal]);

	const reveal = useCallback((next: RevealRequest): void => {
		request.current = next;
		// A field focused while the keyboard is already up gets no new keyboard event.
		if (keyboardTop.current !== null) settleThenReveal();
	}, [settleThenReveal]);

	const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
		offset.current = event.nativeEvent.contentOffset.y;
	}, []);

	return {scrollRef, clearance, onScroll, reveal};
}

/** Lets the fields of a scroll view ask it to keep their form above the keyboard. */
export function KeyboardRevealProvider({reveal, children}: {reveal: Reveal; children: ReactNode}): ReactNode {
	return <RevealContext.Provider value={reveal}>{children}</RevealContext.Provider>;
}

