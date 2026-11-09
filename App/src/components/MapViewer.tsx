import {
	ReactNode, useState
} from "react";
import {
	Image, LayoutChangeEvent, View
} from "react-native";
import {
	GestureDetector, GestureHandlerRootView, useCompetingGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture
} from "react-native-gesture-handler";
import Animated, {
	cancelAnimation, useAnimatedStyle, useSharedValue, withDecay, withSpring
} from "react-native-reanimated";
import {
	BackButton, ModalSurface
} from "@/src/design/Sections";
import { Theme } from "@/src/design/Theme";
import {
	clampPoint, drawnSize, MAP_ZOOM, MapLayout, panLimits, resistedMove, resistedScale, settledView, zoomAround
} from "@/src/display/MapZoom";
import { i18n } from "@/src/translations/i18n";
import { createStyles } from "@/src/design/ThemeContext";

/** Settles without a visible overshoot, fast enough to feel attached to the finger. */
const SETTLE_SPRING = {
	damping: 26, stiffness: 240, mass: 0.9
} as const;
const DECAY_DECELERATION = 0.994;

/** A finger moving further than this is a drag, not a tap: the double tap gives up at once. */
const TAP_MAX_DISTANCE = 12;

const useStyles = createStyles(colors => ({
	root: { flex: 1 },
	toolbar: {
		paddingHorizontal: Theme.spacing.xl, paddingTop: Theme.spacing.md
	},
	stage: {
		flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden"
	},
	image: { backgroundColor: colors.wash }
}));

function MapFrame({
	onClose, children
}: {
	onClose: () => void; children: ReactNode;
}): ReactNode {
	const styles = useStyles();
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
export function MapViewer({
	uri, onClose, onError, ratio
}: {
	uri: string;
	onClose: () => void;
	onError: () => void;
	ratio: number;
}): ReactNode {
	const styles = useStyles();
	const [frame, setFrame] = useState({
		width: 0, height: 0
	});
	const scale = useSharedValue<number>(MAP_ZOOM.min);
	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const focal = useSharedValue({
		x: 0, y: 0
	});
	const image = drawnSize(frame, ratio);
	const layout: MapLayout = {
		image, frame
	};

	const stop = (): void => {
		"worklet";
		cancelAnimation(scale);
		cancelAnimation(x);
		cancelAnimation(y);
	};
	const springTo = (target: {
		scale: number; x: number; y: number;
	}): void => {
		"worklet";
		scale.set(withSpring(target.scale, SETTLE_SPRING));
		x.set(withSpring(target.x, SETTLE_SPRING));
		y.set(withSpring(target.y, SETTLE_SPRING));
	};
	const settle = (): void => {
		"worklet";
		springTo(settledView({
			scale: scale.get(), x: x.get(), y: y.get()
		}, layout));
	};
	const fromCentre = (pointX: number, pointY: number): {
		x: number; y: number;
	} => {
		"worklet";
		return {
			x: pointX - frame.width / 2, y: pointY - frame.height / 2
		};
	};

	// Two fingers also drag: the move of their midpoint is added to the zoom around it.
	const pinch = usePinchGesture({
		testID: "map-pinch",
		onActivate: event => {
			stop();
			focal.set(fromCentre(event.focalX, event.focalY));
		},
		onUpdate: event => {
			if (event.numberOfPointers !== 2) {
				return;
			}
			const point = fromCentre(event.focalX, event.focalY);
			const zoomed = zoomAround({
				scale: scale.get(), x: x.get(), y: y.get()
			}, focal.get(), resistedScale(scale.get(), event.scaleChange));
			scale.set(zoomed.scale);
			x.set(zoomed.x + point.x - focal.get().x);
			y.set(zoomed.y + point.y - focal.get().y);
			focal.set(point);
		},
		onDeactivate: settle
	});

	const pan = usePanGesture({
		testID: "map-pan",
		maxPointers: 1,
		onActivate: stop,
		onUpdate: event => {
			const moved = resistedMove({
				x: x.get(), y: y.get()
			}, {
				x: event.changeX, y: event.changeY
			}, panLimits(layout, scale.get()));
			x.set(moved.x);
			y.set(moved.y);
		},
		onDeactivate: event => {
			if (event.canceled) {
				return;
			}
			const limits = panLimits(layout, scale.get());
			x.set(withDecay({
				velocity: event.velocityX, deceleration: DECAY_DECELERATION, clamp: [-limits.x, limits.x], rubberBandEffect: true
			}));
			y.set(withDecay({
				velocity: event.velocityY, deceleration: DECAY_DECELERATION, clamp: [-limits.y, limits.y], rubberBandEffect: true
			}));
		}
	});

	const doubleTap = useTapGesture({
		numberOfTaps: 2,
		maxDistance: TAP_MAX_DISTANCE,
		onDeactivate: event => {
			stop();
			const target = scale.get() > MAP_ZOOM.min
				? {
					scale: MAP_ZOOM.min, x: 0, y: 0
				}
				: zoomAround({
					scale: scale.get(), x: x.get(), y: y.get()
				}, fromCentre(event.x, event.y), MAP_ZOOM.doubleTap);
			springTo({
				scale: target.scale, ...clampPoint(target, panLimits(layout, target.scale))
			});
		}
	});

	// Competing, not exclusive: pinching and dragging must not wait for the double tap to fail first.
	const gesture = useCompetingGestures(useSimultaneousGestures(pinch, pan), doubleTap);

	const transform = useAnimatedStyle(() => ({
		transform: [
			{ translateX: x.get() },
			{ translateY: y.get() },
			{ scale: scale.get() }
		]
	}));

	return <MapFrame onClose={onClose}>
		<GestureDetector gesture={gesture}>
			<View
				testID="map-stage"
				style={styles.stage}
				onLayout={(event: LayoutChangeEvent): void => setFrame(event.nativeEvent.layout)}
			>
				<Animated.View style={transform}>
					<Image
						accessibilityLabel={i18n.t("app:map.image")}
						source={{ uri }}
						style={[styles.image, image]}
						resizeMode="contain"
						onError={onError}
					/>
				</Animated.View>
			</View>
		</GestureDetector>
	</MapFrame>;
}
