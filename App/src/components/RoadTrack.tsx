import {
	ReactNode, useMemo
} from "react";
import {
	Animated, StyleSheet, View
} from "react-native";
import { Theme } from "@/src/design/Theme";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { createStyles } from "@/src/design/ThemeContext";
import { useMeasuredWidth } from "@/src/design/useMeasuredWidth";

/** The hop and lean of each stride while the traveller runs. */
const STRIDE = {
	hop: -7, lean: "10deg"
} as const;

const useStyles = createStyles(colors => ({
	track: {
		flex: 1, height: 6
	},
	groove: {
		...StyleSheet.absoluteFill, borderRadius: Theme.pillRadius, overflow: "hidden", backgroundColor: colors.line
	},
	fill: {
		...StyleSheet.absoluteFill, borderRadius: Theme.pillRadius
	},
	unmeasured: { opacity: 0 },
	runner: {
		position: "absolute", left: 0, top: -Theme.dimensions.headerIcon + Theme.spacing.xs, marginLeft: -Theme.dimensions.quickActionIcon / 2
	}
}));

/**
 * A road filled up to `progress` (0 to 1) with the traveller standing at its tip. Both only slide, so the
 * progress can be driven by the native animation driver.
 */
export function RoadTrack({
	progress, stride, runner, fillColor
}: {
	progress: Animated.Value; stride: Animated.Value; runner: string; fillColor: string;
}): ReactNode {
	const styles = useStyles();
	const {
		width, onLayout
	} = useMeasuredWidth();
	const {
		fillShift, runnerShift
	} = useMemo(() => {
		const along = (from: number, to: number): Animated.AnimatedInterpolation<number> => progress.interpolate({
			inputRange: [0, 1], outputRange: [from, to], extrapolate: "clamp"
		});
		return {
			fillShift: along(-width, 0), runnerShift: along(0, width)
		};
	}, [progress, width]);
	return <View style={styles.track} onLayout={onLayout} testID="road-track">
		<View style={styles.groove}>
			<Animated.View testID="road-fill" style={[
				styles.fill,
				{
					backgroundColor: fillColor, transform: [{ translateX: fillShift }]
				},
				width === 0 && styles.unmeasured
			]} />
		</View>
		<Animated.View testID="road-runner" style={[styles.runner, { transform: [{ translateX: runnerShift }] }]}>
			{/* Twemoji draws the walker and the ferry heading left, so they are mirrored to face the destination. */}
			<Animated.View style={{ transform: [
				{ translateY: stride.interpolate({
					inputRange: [0, 1], outputRange: [0, STRIDE.hop]
				}) },
				{ rotate: stride.interpolate({
					inputRange: [0, 1], outputRange: ["0deg", STRIDE.lean]
				}) },
				{ scaleX: -1 }
			] }}>
				<TwemojiIcon emoji={runner} size={Theme.dimensions.quickActionIcon} />
			</Animated.View>
		</Animated.View>
	</View>;
}
