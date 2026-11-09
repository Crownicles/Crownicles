import {
	ReactNode, useEffect, useState
} from "react";
import {
	Animated, Easing, Text, View
} from "react-native";
import {
	LucideIcon, Sparkles
} from "@/src/design/FightIcons";
import {
	PaletteColor, Theme
} from "@/src/design/Theme";
import { useReducedMotion } from "@/src/store/useReducedMotion";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";

const FAREWELL_EMBLEM = {
	area: 132, halo: 104, haloGrowth: 1.06
} as const;

const SPARKLE_MOTION = {
	twinkleMs: 2400, dim: 0.2, size: 18, flashSpan: 0.14
} as const;

/** Where each sparkle sits around the emblem, and when in the cycle it catches the light. */
const SPARKLES = [
	{
		style: {
			top: 10, left: 14
		},
		phase: 0.05
	},
	{
		style: {
			top: 22, right: 8
		},
		phase: 0.35
	},
	{
		style: {
			bottom: 12, left: 30
		},
		phase: 0.65
	}
] as const;

export const FAREWELL_TONES = {
	GAIN: "gain",
	LOSS: "loss"
} as const;
export type FarewellTone = typeof FAREWELL_TONES[keyof typeof FAREWELL_TONES];

export type FarewellTip = {
	icon: LucideIcon; text: string; tone: FarewellTone;
};

const TONE_COLORS: Record<FarewellTone, {
	icon: PaletteColor; wash: PaletteColor;
}> = {
	[FAREWELL_TONES.GAIN]: {
		icon: "green", wash: "greenWash"
	},
	[FAREWELL_TONES.LOSS]: {
		icon: "red", wash: "redWash"
	}
};

const useStyles = createStyles(colors => ({
	page: {
		alignItems: "center",
		marginBottom: Theme.spacing.xl,
		paddingVertical: Theme.spacing.xxl,
		paddingHorizontal: Theme.spacing.xl,
		borderRadius: Theme.radius,
		backgroundColor: colors.paper
	},
	emblem: {
		width: FAREWELL_EMBLEM.area, height: FAREWELL_EMBLEM.area, alignItems: "center", justifyContent: "center", marginBottom: Theme.spacing.md
	},
	halo: {
		position: "absolute", width: FAREWELL_EMBLEM.halo, height: FAREWELL_EMBLEM.halo, borderRadius: FAREWELL_EMBLEM.halo / 2
	},
	sparkle: { position: "absolute" },
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
		color: colors.ink
	},
	description: {
		marginTop: Theme.spacing.sm,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		textAlign: "center",
		color: colors.muted
	},
	tips: {
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.lg,
		gap: Theme.spacing.md,
		borderRadius: Theme.radius,
		backgroundColor: colors.paper
	},
	tipsTitle: {
		fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: colors.ink
	},
	tip: {
		flexDirection: "row", alignItems: "center", gap: Theme.spacing.md
	},
	tipIcon: {
		width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center"
	},
	tipText: {
		flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: colors.ink
	}
}));

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
	}, [
		value,
		durationMs,
		pingPong,
		reducedMotion
	]);
	return value;
}

/**
 * Rises from `rest` to `peak` then falls back over `2 × span` of the cycle, starting at `phase`.
 * The window must end inside the cycle: keep `phase` below `1 - 2 × span`.
 */
export function cycleWindow(cycle: Animated.Value, {
	phase, span, rest, peak
}: {
	phase: number; span: number; rest: number; peak: number;
}): Animated.AnimatedInterpolation<number> {
	return cycle.interpolate({
		inputRange: [
			0,
			phase,
			phase + span,
			phase + span * 2,
			1
		],
		outputRange: [
			rest,
			rest,
			peak,
			rest,
			rest
		]
	});
}

/** The round stage of a farewell: a halo that breathes with `pulse`, and whatever floats over it. */
export function FarewellEmblem({
	pulse, haloColor, children
}: {
	pulse: Animated.Value; haloColor: string; children: ReactNode;
}): ReactNode {
	const styles = useStyles();
	return <View style={styles.emblem}>
		<Animated.View style={[
			styles.halo, {
				backgroundColor: haloColor,
				transform: [
					{ scale: pulse.interpolate({
						inputRange: [0, 1], outputRange: [1, FAREWELL_EMBLEM.haloGrowth]
					}) }
				]
			}
		]} />
		{children}
	</View>;
}

/** A few gold sparkles catching the light in turn around an emblem. */
export function FarewellSparkles(): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const twinkle = useMotionLoop(SPARKLE_MOTION.twinkleMs, false);
	return SPARKLES.map(sparkle => {
		const light = cycleWindow(twinkle, {
			phase: sparkle.phase, span: SPARKLE_MOTION.flashSpan, rest: SPARKLE_MOTION.dim, peak: 1
		});
		return <Animated.View
			key={sparkle.phase}
			style={[
				styles.sparkle,
				sparkle.style,
				{
					opacity: light, transform: [{ scale: light }]
				}
			]}
		>
			<Sparkles size={SPARKLE_MOTION.size} color={colors.gold} />
		</Animated.View>;
	});
}

/** The page a blocked moment of the game opens on: a moving emblem, then what happened, told gently. */
export function FarewellPage({
	emblem, eyebrow, eyebrowColor, title, description
}: {
	emblem: ReactNode;
	eyebrow: string;
	eyebrowColor: string;
	title: string;
	description: string;
}): ReactNode {
	const styles = useStyles();
	return <View style={styles.page}>
		{emblem}
		<Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text>
		<Text style={styles.title}>{title}</Text>
		<Text style={styles.description}>{description}</Text>
	</View>;
}

function Tip({
	icon: Icon, text, tone
}: FarewellTip): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const tones = TONE_COLORS[tone];
	return <View style={styles.tip}>
		<View style={[styles.tipIcon, { backgroundColor: colors[tones.wash] }]}><Icon size={16} color={colors[tones.icon]} /></View>
		<Text style={styles.tipText}>{text}</Text>
	</View>;
}

export function FarewellTips({
	title, tips
}: {
	title: string; tips: FarewellTip[];
}): ReactNode {
	const styles = useStyles();
	return <View style={styles.tips}>
		<Text style={styles.tipsTitle}>{title}</Text>
		{tips.map(tip => <Tip key={tip.text} {...tip} />)}
	</View>;
}
