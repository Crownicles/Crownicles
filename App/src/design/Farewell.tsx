import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import {LucideIcon} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {useReducedMotion} from "@/src/store/useReducedMotion";

const FAREWELL_EMBLEM = {area: 132, halo: 104, haloGrowth: 1.06} as const;

export const FAREWELL_TONES = {
	GAIN: "gain",
	LOSS: "loss"
} as const;
export type FarewellTone = typeof FAREWELL_TONES[keyof typeof FAREWELL_TONES];

export type FarewellTip = {icon: LucideIcon; text: string; tone: FarewellTone};

const TONE_COLORS: Record<FarewellTone, {icon: string; wash: string}> = {
	[FAREWELL_TONES.GAIN]: {icon: Theme.colors.green, wash: Theme.colors.greenWash},
	[FAREWELL_TONES.LOSS]: {icon: Theme.colors.red, wash: Theme.colors.redWash}
};

const styles = StyleSheet.create({
	page: {
		alignItems: "center",
		marginBottom: Theme.spacing.xl,
		paddingVertical: Theme.spacing.xxl,
		paddingHorizontal: Theme.spacing.xl,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	emblem: {width: FAREWELL_EMBLEM.area, height: FAREWELL_EMBLEM.area, alignItems: "center", justifyContent: "center", marginBottom: Theme.spacing.md},
	halo: {position: "absolute", width: FAREWELL_EMBLEM.halo, height: FAREWELL_EMBLEM.halo, borderRadius: FAREWELL_EMBLEM.halo / 2},
	eyebrow: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		letterSpacing: Theme.letterSpacing.eyebrow,
		textTransform: "uppercase"
	},
	title: {
		marginTop: Theme.spacing.xs,
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.title,
		textAlign: "center",
		color: Theme.colors.ink
	},
	description: {
		marginTop: Theme.spacing.sm,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		textAlign: "center",
		color: Theme.colors.muted
	},
	tips: {
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.lg,
		gap: Theme.spacing.md,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	tipsTitle: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink},
	tip: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	tipIcon: {width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center"},
	tipText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: Theme.colors.ink}
});

/** A value running 0 → 1 forever, back and forth when `pingPong`; it stays still under reduced motion. */
export function useMotionLoop(durationMs: number, pingPong: boolean): Animated.Value {
	const reducedMotion = useReducedMotion();
	const [value] = useState(() => new Animated.Value(0));
	useEffect(() => {
		if (reducedMotion) {
			return undefined;
		}
		const timing = (toValue: number): Animated.CompositeAnimation => Animated.timing(value, {
			toValue, duration: durationMs, easing: pingPong ? Easing.inOut(Easing.sin) : Easing.linear, useNativeDriver: true
		});
		const loop = Animated.loop(pingPong ? Animated.sequence([timing(1), timing(0)]) : timing(1));
		loop.start();
		return (): void => loop.stop();
	}, [value, durationMs, pingPong, reducedMotion]);
	return value;
}

/**
 * Rises from `rest` to `peak` then falls back over `2 × span` of the cycle, starting at `phase`.
 * The window must end inside the cycle: keep `phase` below `1 - 2 × span`.
 */
export function cycleWindow(cycle: Animated.Value, {phase, span, rest, peak}: {phase: number; span: number; rest: number; peak: number}): Animated.AnimatedInterpolation<number> {
	return cycle.interpolate({
		inputRange: [0, phase, phase + span, phase + span * 2, 1],
		outputRange: [rest, rest, peak, rest, rest]
	});
}

/** The round stage of a farewell: a halo that breathes with `pulse`, and whatever floats over it. */
export function FarewellEmblem({pulse, haloColor, children}: {pulse: Animated.Value; haloColor: string; children: ReactNode}): ReactNode {
	return <View style={styles.emblem}>
		<Animated.View style={[styles.halo, {
			backgroundColor: haloColor,
			transform: [{scale: pulse.interpolate({inputRange: [0, 1], outputRange: [1, FAREWELL_EMBLEM.haloGrowth]})}]
		}]} />
		{children}
	</View>;
}

/** The page a blocked moment of the game opens on: a moving emblem, then what happened, told gently. */
export function FarewellPage({emblem, eyebrow, eyebrowColor, title, description}: {
	emblem: ReactNode;
	eyebrow: string;
	eyebrowColor: string;
	title: string;
	description: string;
}): ReactNode {
	return <View style={styles.page}>
		{emblem}
		<Text style={[styles.eyebrow, {color: eyebrowColor}]}>{eyebrow}</Text>
		<Text style={styles.title}>{title}</Text>
		<Text style={styles.description}>{description}</Text>
	</View>;
}

function Tip({icon: Icon, text, tone}: FarewellTip): ReactNode {
	const colors = TONE_COLORS[tone];
	return <View style={styles.tip}>
		<View style={[styles.tipIcon, {backgroundColor: colors.wash}]}><Icon size={16} color={colors.icon} /></View>
		<Text style={styles.tipText}>{text}</Text>
	</View>;
}

export function FarewellTips({title, tips}: {title: string; tips: FarewellTip[]}): ReactNode {
	return <View style={styles.tips}>
		<Text style={styles.tipsTitle}>{title}</Text>
		{tips.map(tip => <Tip key={tip.text} {...tip} />)}
	</View>;
}
