import {
	createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState
} from "react";
import {Animated, BackHandler, PanResponder, StyleSheet, useWindowDimensions} from "react-native";
import {useFocusEffect} from "expo-router";
import {Theme} from "@/src/design/Theme";

/** Where a finger may start the gesture, so a tap on a row is never mistaken for a way out. */
const EDGE_WIDTH = 42;
const ACTIVATION_DISTANCE = 12;
const RELEASE_RATIO = 0.32;
const RELEASE_VELOCITY = 0.5;
const CLOSE_DURATION = 170;

type Gesture = {x0: number; dx: number; dy: number; vx: number};

/** A drag the view should follow: born on the edge, clearly horizontal, already under way. */
export function edgeSwipeStarts(gesture: Pick<Gesture, "x0" | "dx" | "dy">): boolean {
	return gesture.x0 < EDGE_WIDTH && gesture.dx > ACTIVATION_DISTANCE && Math.abs(gesture.dy) < gesture.dx;
}

/** A drag long enough, or thrown fast enough, to mean the player wants out. */
export function edgeSwipeCloses(gesture: Pick<Gesture, "dx" | "vx">, width: number): boolean {
	return gesture.dx > width * RELEASE_RATIO || gesture.vx > RELEASE_VELOCITY;
}

const sheetStyle = {
	backgroundColor: Theme.colors.wash,
	shadowColor: Theme.colors.shadow,
	shadowOpacity: 0.16,
	shadowRadius: 12,
	shadowOffset: {
		width: -4,
		height: 0
	},
	elevation: 12
};

const styles = StyleSheet.create({
	sheet: {
		...sheetStyle,
		flex: 1
	},
	overlay: {
		...sheetStyle,
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	}
});

const SwipeBackDepth = createContext<((delta: number) => void) | null>(null);
const SwipeBackOpen = createContext(false);

/** Tab paging and the back gesture both live on a horizontal drag, so only one of them may listen at a time. */
export function SwipeBackBoundary({children}: {children: ReactNode}): ReactNode {
	const [depth, setDepth] = useState(0);
	const change = useCallback((delta: number) => setDepth(current => current + delta), []);
	return <SwipeBackDepth.Provider value={change}><SwipeBackOpen.Provider value={depth > 0}>{children}</SwipeBackOpen.Provider></SwipeBackDepth.Provider>;
}

/** Whether a detail view is currently stacked over the tab it belongs to. */
export function useSwipeBackOpen(): boolean {
	return useContext(SwipeBackOpen);
}

/** Dragging from the left edge closes the view, the same way a pushed route would. */
export function SwipeBack({onClose, overlay, children}: {onClose: () => void; overlay?: boolean; children: ReactNode}): ReactNode {
	const {width} = useWindowDimensions();
	const [translateX] = useState(() => new Animated.Value(0));
	const reportDepth = useContext(SwipeBackDepth);
	useEffect(() => {
		reportDepth?.(1);
		return (): void => reportDepth?.(-1);
	}, [reportDepth]);
	useFocusEffect(useCallback(() => {
		const listener = BackHandler.addEventListener("hardwareBackPress", () => {
			onClose();
			return true;
		});
		return (): void => listener.remove();
	}, [onClose]));
	const responder = useMemo(() => {
		const settle = (): void => {
			Animated.spring(translateX, {
				toValue: 0,
				useNativeDriver: true,
				bounciness: 0
			}).start();
		};
		return PanResponder.create({
			/** Claimed on capture, otherwise the scrolling content underneath keeps the finger for itself. */
			onMoveShouldSetPanResponderCapture: (_event, gesture) => edgeSwipeStarts(gesture),
			onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(0, gesture.dx)),
			onPanResponderRelease: (_event, gesture) => {
				if (edgeSwipeCloses(gesture, width)) {
					Animated.timing(translateX, {
						toValue: width,
						duration: CLOSE_DURATION,
						useNativeDriver: true
					}).start(onClose);
					return;
				}
				settle();
			},
			onPanResponderTerminate: settle
		});
	}, [onClose, translateX, width]);
	return <Animated.View testID="swipe-back" style={[overlay ? styles.overlay : styles.sheet, {transform: [{translateX}]}]} {...responder.panHandlers}>{children}</Animated.View>;
}
