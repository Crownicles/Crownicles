import {
	useCallback, useState
} from "react";
import { useFocusEffect } from "expo-router";

/** Whether the screen holding the caller is the one on display; a tab kept alive behind another one is not. */
export function useScreenFocused(): boolean {
	const [focused, setFocused] = useState(true);
	useFocusEffect(useCallback(() => {
		setFocused(true);
		return (): void => setFocused(false);
	}, []));
	return focused;
}
