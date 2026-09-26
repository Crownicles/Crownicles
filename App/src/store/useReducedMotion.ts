import {useEffect, useState} from "react";
import {AccessibilityInfo} from "react-native";

/** The system-wide preference every animated screen honours. */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		let active = true;
		AccessibilityInfo.isReduceMotionEnabled().then(value => {if (active) setReduced(value);}).catch(() => undefined);
		const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
		return (): void => {active = false; subscription.remove();};
	}, []);
	return reduced;
}
