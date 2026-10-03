import {ReactElement, ReactNode, useMemo} from "react";
import {Animated, View, ViewStyle} from "react-native";

type ProgressRingProps = {
	/** From 0 to 1; animated so the ring can glide between two readings. */
	progress: Animated.Value;
	size: number;
	thickness: number;
	color: string;
	children?: ReactNode;
};

/** A border on two adjacent sides draws a half circle; turned 45° it covers the right half exactly. */
const HALF_ARC_REST_DEG = 45;
const HALF_TURN_DEG = 180;
const HALF_TURN = 0.5;
const TRACK_OPACITY = 0.18;

type HalfArcProps = Omit<ProgressRingProps, "progress" | "children"> & {
	side: "left" | "right";
	rotate: Animated.AnimatedInterpolation<string>;
};

/** One half of the ring: an arc turned into view, clipped by the half it lives in. */
function HalfArc({side, rotate, size, thickness, color}: HalfArcProps): ReactElement {
	const half = size / 2;
	const clip: ViewStyle = {position: "absolute", top: 0, width: half, height: size, overflow: "hidden", [side]: 0};
	const arc: ViewStyle = {
		position: "absolute",
		top: 0,
		left: side === "right" ? -half : 0,
		width: size,
		height: size,
		borderRadius: half,
		borderWidth: thickness,
		borderColor: "transparent",
		borderTopColor: color,
		borderRightColor: color
	};
	return <View style={clip}><Animated.View style={[arc, {transform: [{rotate}]}]} /></View>;
}

/** Turns the arc from hidden to shown while the progress crosses its half of the ring. */
function arcRotation(progress: Animated.Value, from: number): Animated.AnimatedInterpolation<string> {
	return progress.interpolate({
		inputRange: [from, from + HALF_TURN],
		outputRange: [`${HALF_ARC_REST_DEG + from * 2 * HALF_TURN_DEG - HALF_TURN_DEG}deg`, `${HALF_ARC_REST_DEG + from * 2 * HALF_TURN_DEG}deg`],
		extrapolate: "clamp"
	});
}

/** A thin ring filling clockwise from the top, drawn without any vector library. */
export function ProgressRing({progress, size, thickness, color, children}: ProgressRingProps): ReactElement {
	// New interpolation nodes on every render would detach the running native animation.
	const rotations = useMemo(() => ({right: arcRotation(progress, 0), left: arcRotation(progress, HALF_TURN)}), [progress]);
	const track: ViewStyle = {position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: color, opacity: TRACK_OPACITY};
	return <View style={{width: size, height: size, alignItems: "center", justifyContent: "center"}} testID="progress-ring">
		<View style={track} />
		<HalfArc side="right" rotate={rotations.right} size={size} thickness={thickness} color={color} />
		<HalfArc side="left" rotate={rotations.left} size={size} thickness={thickness} color={color} />
		{children}
	</View>;
}
