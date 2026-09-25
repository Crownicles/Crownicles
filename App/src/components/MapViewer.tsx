import {ReactNode, useState} from "react";
import {Image, LayoutChangeEvent, StyleSheet, View} from "react-native";
import {Gesture, GestureDetector, GestureHandlerRootView} from "react-native-gesture-handler";
import Animated, {cancelAnimation, useAnimatedStyle, useSharedValue, withDecay, withSpring} from "react-native-reanimated";
import {BackButton, ModalSurface} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {
	clampTo, drawnSize, MAP_ZOOM, panLimit, resisted, resistedScale, settledView, zoomAround
} from "@/src/display/MapZoom";
import {i18n} from "@/src/translations/i18n";

/** Settles without a visible overshoot, fast enough to feel attached to the finger. */
const SETTLE_SPRING = {damping: 26, stiffness: 240, mass: 0.9} as const;
const DECAY_DECELERATION = 0.994;
/** A finger moving further than this is a drag, not a tap: the double tap gives up at once. */
const TAP_MAX_DISTANCE = 12;

const styles = StyleSheet.create({
	root: {flex: 1},
	toolbar: {paddingHorizontal: Theme.spacing.xl, paddingTop: Theme.spacing.md},
	stage: {flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden"},
	image: {backgroundColor: Theme.colors.wash}
});

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
 * The world map, examined the way a photo is on a phone: it zooms under the fingers, keeps gliding
 * when flung, stretches a little past its edges and zoom limits, then eases back.
 */
export function MapViewer({uri, onClose, onError, ratio}: {
	uri: string;
	onClose: () => void;
	onError: () => void;
	ratio: number;
}): ReactNode {
	const [frame, setFrame] = useState({width: 0, height: 0});
	const scale = useSharedValue<number>(MAP_ZOOM.min);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const focal = useSharedValue({x: 0, y: 0});
	const image = drawnSize(frame, ratio);

	const stop = (): void => {
		"worklet";
		cancelAnimation(scale);
		cancelAnimation(x);
		cancelAnimation(y);
	};
	const settle = (): void => {
		"worklet";
		const target = settledView({scale: scale.value, x: x.value, y: y.value}, image, frame);
		scale.value = withSpring(target.scale, SETTLE_SPRING);
		x.value = withSpring(target.x, SETTLE_SPRING);
		y.value = withSpring(target.y, SETTLE_SPRING);
	};
	const fromCentre = (pointX: number, pointY: number): {x: number; y: number} => {
		"worklet";
		return {x: pointX - frame.width / 2, y: pointY - frame.height / 2};
	};

	// Two fingers also drag: the move of their midpoint is added to the zoom around it.
	const pinch = Gesture.Pinch()
		.onStart(event => {
			stop();
			focal.value = fromCentre(event.focalX, event.focalY);
		})
		.onChange(event => {
			const point = fromCentre(event.focalX, event.focalY);
			const zoomed = zoomAround({scale: scale.value, x: x.value, y: y.value}, point, resistedScale(scale.value, event.scaleChange));
			scale.value = zoomed.scale;
			x.value = zoomed.x + point.x - focal.value.x;
			y.value = zoomed.y + point.y - focal.value.y;
			focal.value = point;
		})
		.onEnd(settle);

	const pan = Gesture.Pan()
		.maxPointers(1)
		.onStart(stop)
		.onChange(event => {
			x.value = resisted(x.value, event.changeX, panLimit(image.width, frame.width, scale.value));
			y.value = resisted(y.value, event.changeY, panLimit(image.height, frame.height, scale.value));
		})
		.onEnd(event => {
			const limitX = panLimit(image.width, frame.width, scale.value);
			const limitY = panLimit(image.height, frame.height, scale.value);
			x.value = withDecay({velocity: event.velocityX, deceleration: DECAY_DECELERATION, clamp: [-limitX, limitX], rubberBandEffect: true});
			y.value = withDecay({velocity: event.velocityY, deceleration: DECAY_DECELERATION, clamp: [-limitY, limitY], rubberBandEffect: true});
		});

	const doubleTap = Gesture.Tap()
		.numberOfTaps(2)
		.maxDistance(TAP_MAX_DISTANCE)
		.onEnd(event => {
			stop();
			const target = scale.value > MAP_ZOOM.min
				? {scale: MAP_ZOOM.min, x: 0, y: 0}
				: zoomAround({scale: scale.value, x: x.value, y: y.value}, fromCentre(event.x, event.y), MAP_ZOOM.doubleTap);
			scale.value = withSpring(target.scale, SETTLE_SPRING);
			x.value = withSpring(clampTo(target.x, panLimit(image.width, frame.width, target.scale)), SETTLE_SPRING);
			y.value = withSpring(clampTo(target.y, panLimit(image.height, frame.height, target.scale)), SETTLE_SPRING);
		});

	const transform = useAnimatedStyle(() => ({
		transform: [{translateX: x.value}, {translateY: y.value}, {scale: scale.value}]
	}));

	return <MapFrame onClose={onClose}>
		{/* Race, not Exclusive: pinching and dragging must not wait for the double tap to fail first. */}
		<GestureDetector gesture={Gesture.Race(Gesture.Simultaneous(pinch, pan), doubleTap)}>
			<View
				style={styles.stage}
				onLayout={(event: LayoutChangeEvent): void => setFrame(event.nativeEvent.layout)}
			>
				<Animated.View style={transform}>
					<Image
						accessibilityLabel={i18n.t("app:map.image")}
						source={{uri}}
						style={[styles.image, image]}
						resizeMode="contain"
						onError={onError}
					/>
				</Animated.View>
			</View>
		</GestureDetector>
	</MapFrame>;
}
