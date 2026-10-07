import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, StyleSheet} from "react-native";
import {useReducedMotion} from "@/src/store/useReducedMotion";

const ENTRANCE = {durationMs: 320, offset: 28} as const;

const styles = StyleSheet.create({
	fill: {flex: 1}
});

/** A new page of the journey rises into place instead of popping over the previous one; re-key it to play again. */
export function Entrance({children}: {children: ReactNode}): ReactNode {
	const reducedMotion = useReducedMotion();
	const [shown] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
	useEffect(() => {
		Animated.timing(shown, {toValue: 1, duration: ENTRANCE.durationMs, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
	}, [shown]);
	return <Animated.View style={[styles.fill, {
		opacity: shown,
		transform: [{translateY: shown.interpolate({inputRange: [0, 1], outputRange: [ENTRANCE.offset, 0]})}]
	}]}>{children}</Animated.View>;
}
