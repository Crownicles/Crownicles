import { useState } from "react";
import { LayoutChangeEvent } from "react-native";

/** The laid-out width of a view, 0 until its first layout: what a native-driven slide needs to know how far to go. */
export function useMeasuredWidth(): {
	width: number; onLayout: (event: LayoutChangeEvent) => void;
} {
	const [width, setWidth] = useState(0);
	return {
		width, onLayout: (event: LayoutChangeEvent): void => setWidth(event.nativeEvent.layout.width)
	};
}
