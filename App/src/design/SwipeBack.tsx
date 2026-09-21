import {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Animated, BackHandler, PanResponder, StyleSheet, useWindowDimensions} from "react-native";
import {useFocusEffect} from "expo-router";
import {Theme} from "@/src/design/Theme";

/** Where a finger may start the gesture, so a tap on a row is never mistaken for a way out. */
const EDGE_WIDTH = 42;
const ACTIVATION_DISTANCE = 12;
const RELEASE_RATIO = 0.32;
const RELEASE_VELOCITY = 0.5;
const CLOSE_DURATION = 170;

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: Theme.colors.wash
	}
});

/** Dragging from the left edge closes the view, the same way a pushed route would. */
export function SwipeBack({onClose, children}: {onClose: () => void; children: ReactNode}): ReactNode {
	const {width} = useWindowDimensions();
	const [translateX] = useState(() => new Animated.Value(0));
	const close = useRef(onClose);
	useEffect(() => {
		close.current = onClose;
	}, [onClose]);
	useFocusEffect(useCallback(() => {
		const listener = BackHandler.addEventListener("hardwareBackPress", () => {
			close.current();
			return true;
		});
		return (): void => listener.remove();
	}, []));
	const responder = useMemo(() => {
		const settle = (): void => {
			Animated.spring(translateX, {
				toValue: 0,
				useNativeDriver: true,
				bounciness: 0
			}).start();
		};
		return PanResponder.create({
			onMoveShouldSetPanResponder: (_event, gesture) => gesture.x0 < EDGE_WIDTH && gesture.dx > ACTIVATION_DISTANCE && Math.abs(gesture.dy) < gesture.dx,
			onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(0, gesture.dx)),
			onPanResponderRelease: (_event, gesture) => {
				if (gesture.dx > width * RELEASE_RATIO || gesture.vx > RELEASE_VELOCITY) {
					Animated.timing(translateX, {
						toValue: width,
						duration: CLOSE_DURATION,
						useNativeDriver: true
					}).start(() => {
						translateX.setValue(0);
						close.current();
					});
					return;
				}
				settle();
			},
			onPanResponderTerminate: settle
		});
	}, [translateX, width]);
	return <Animated.View style={[styles.root, {transform: [{translateX}]}]} {...responder.panHandlers}>{children}</Animated.View>;
}
