import {
	RefObject, useEffect, useRef, useState
} from "react";
import {
	Keyboard, Platform, ScrollView
} from "react-native";

type KeyboardClearance = {
	scrollRef: RefObject<ScrollView | null>;
	clearance: number;
};

/**
 * Height to take off a scroll view so the Android keyboard does not cover the field being typed in.
 *
 * The app is drawn edge to edge, so Android no longer shrinks the window when the keyboard opens. Once
 * the scroll view is shortened, Android scrolls the focused field back into sight by itself. iOS needs
 * none of this: `automaticallyAdjustKeyboardInsets` does the same natively.
 */
export function useKeyboardClearance(): KeyboardClearance {
	const scrollRef = useRef<ScrollView>(null);
	const [clearance, setClearance] = useState(0);
	const applied = useRef(0);

	useEffect(() => {
		if (Platform.OS !== "android") {
			return undefined;
		}

		const apply = (value: number): void => {
			applied.current = value;
			setClearance(value);
		};
		const shown = Keyboard.addListener("keyboardDidShow", ({endCoordinates}) => {
			scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
				// Android re-emits the event when the keyboard changes height: measure from where the view would end unshortened.
				apply(Math.max(0, y + height + applied.current - endCoordinates.screenY));
			});
		});
		const hidden = Keyboard.addListener("keyboardDidHide", () => {
			apply(0);
		});

		return (): void => {
			shown.remove();
			hidden.remove();
		};
	}, []);

	return {
		scrollRef,
		clearance
	};
}
