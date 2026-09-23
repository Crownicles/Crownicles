import {ReactNode, useState} from "react";
import {Image, LayoutChangeEvent, StyleSheet, View} from "react-native";
import {Gesture, GestureDetector, GestureHandlerRootView} from "react-native-gesture-handler";
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from "react-native-reanimated";
import {BackButton, ModalSurface} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DOUBLE_TAP_ZOOM = 2.5;
const SETTLE_DURATION = 180;

const styles = StyleSheet.create({
	root: {flex: 1},
	toolbar: {paddingHorizontal: Theme.spacing.xl, paddingTop: Theme.spacing.md},
	stage: {flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden"},
	image: {backgroundColor: Theme.colors.wash}
});

/** The image is laid out at its exact drawn size, so panning knows where its edges are. */
function drawnSize(frame: {width: number; height: number}, ratio: number): {width: number; height: number} {
	if (frame.width === 0 || frame.height === 0) return {width: 0, height: 0};
	return frame.width / frame.height > ratio
		? {width: frame.height * ratio, height: frame.height}
		: {width: frame.width, height: frame.width / ratio};
}

function MapFrame({onClose, children}: {onClose: () => void; children: ReactNode}): ReactNode {
	return <ModalSurface tone="wash">
		<GestureHandlerRootView style={styles.root}>
			<View style={styles.toolbar}>
				<BackButton label={i18n.t("app:common.back")} onClose={onClose} />
			</View>
			{children}
		</GestureHandlerRootView>
	</ModalSurface>;
}

/**
 * The world map, examined the way a map is examined on a phone: pinch to zoom, drag to move,
 * double tap to go back and forth. Panning stops at the edges rather than losing the map offscreen.
 */
export function MapViewer({uri, onClose, onError, ratio}: {
	uri: string;
	onClose: () => void;
	onError: () => void;
	ratio: number;
}): ReactNode {
	const [frame, setFrame] = useState({width: 0, height: 0});
	const scale = useSharedValue(MIN_ZOOM);
	const startScale = useSharedValue(MIN_ZOOM);
	const offsetX = useSharedValue(0);
	const offsetY = useSharedValue(0);
	const startX = useSharedValue(0);
	const startY = useSharedValue(0);
	const size = drawnSize(frame, ratio);

	const bound = (length: number, zoom: number): number => {
		"worklet";
		return Math.max(0, (length * zoom - length) / 2);
	};
	const clamp = (value: number, limit: number): number => {
		"worklet";
		return Math.min(limit, Math.max(-limit, value));
	};
	const settle = (): void => {
		"worklet";
		offsetX.value = withTiming(clamp(offsetX.value, bound(size.width, scale.value)), {duration: SETTLE_DURATION});
		offsetY.value = withTiming(clamp(offsetY.value, bound(size.height, scale.value)), {duration: SETTLE_DURATION});
	};

	const pinch = Gesture.Pinch()
		.onStart(() => {
			startScale.value = scale.value;
		})
		.onUpdate(event => {
			scale.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.value * event.scale));
		})
		.onEnd(settle);

	const pan = Gesture.Pan()
		.onStart(() => {
			startX.value = offsetX.value;
			startY.value = offsetY.value;
		})
		.onUpdate(event => {
			offsetX.value = startX.value + event.translationX;
			offsetY.value = startY.value + event.translationY;
		})
		.onEnd(settle);

	const doubleTap = Gesture.Tap()
		.numberOfTaps(2)
		.onEnd(() => {
			const zoomed = scale.value > MIN_ZOOM;
			scale.value = withTiming(zoomed ? MIN_ZOOM : DOUBLE_TAP_ZOOM, {duration: SETTLE_DURATION});
			offsetX.value = withTiming(0, {duration: SETTLE_DURATION});
			offsetY.value = withTiming(0, {duration: SETTLE_DURATION});
		});

	const transform = useAnimatedStyle(() => ({
		transform: [{translateX: offsetX.value}, {translateY: offsetY.value}, {scale: scale.value}]
	}));

	return <MapFrame onClose={onClose}>
		<GestureDetector gesture={Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan))}>
			<View
				style={styles.stage}
				onLayout={(event: LayoutChangeEvent): void => setFrame(event.nativeEvent.layout)}
			>
				<Animated.View style={transform}>
					<Image
						accessibilityLabel={i18n.t("app:map.image")}
						source={{uri}}
						style={[styles.image, size]}
						resizeMode="contain"
						onError={onError}
					/>
				</Animated.View>
			</View>
		</GestureDetector>
	</MapFrame>;
}
