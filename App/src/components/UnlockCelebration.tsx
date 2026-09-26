import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, Pressable, StyleSheet, Text, View} from "react-native";
import {notificationAsync, NotificationFeedbackType} from "expo-haptics";
import {AppIcons} from "@/src/AppIcons";
import {ActionBanner} from "@/src/design/Sections";
import {FarewellEmblem, useMotionLoop} from "@/src/design/Farewell";
import {ArrowRight, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {JourneyStep} from "@/src/journey/Journey";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {
	useAutomaticSmallEventOutcome, useBigEventOutcome, useHealOutcome, useLotteryOutcome, useShopResult,
	useSmallEventChoiceOutcome, useTokenOutcome, useWitchOutcome
} from "@/src/collectors/ReportEventStore";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {i18n} from "@/src/translations/i18n";

const CELEBRATION_MOTION = {
	backdropMs: 220,
	cardDelayMs: 90,
	burstMs: 900,
	haloMs: 2400,
	emblem: 56,
	emblemOvershoot: 1.3,
	ring: 92,
	ringSpread: 2.6,
	sparkReach: 62,
	sparkSize: 16
} as const;

/** The angles, in radians, at which the sparks fly out of the emblem. */
const SPARK_ANGLES = [-2.6, -1.9, -1.2, -0.5, 0.2, 0.9] as const;

const FILL = {position: "absolute", top: 0, right: 0, bottom: 0, left: 0} as const;

const styles = StyleSheet.create({
	layer: {...FILL, justifyContent: "center", padding: Theme.spacing.xxl},
	backdrop: {...FILL, backgroundColor: Theme.colors.overlay},
	card: {alignItems: "center", paddingTop: Theme.spacing.xl, paddingBottom: Theme.spacing.lg, paddingHorizontal: Theme.spacing.xl, borderRadius: Theme.radius, backgroundColor: Theme.colors.paper},
	burst: {position: "absolute", alignItems: "center", justifyContent: "center"},
	ring: {position: "absolute", width: CELEBRATION_MOTION.ring, height: CELEBRATION_MOTION.ring, borderRadius: CELEBRATION_MOTION.ring / 2, borderWidth: 3, borderColor: Theme.colors.gold},
	eyebrow: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		letterSpacing: Theme.letterSpacing.eyebrow,
		textTransform: "uppercase",
		color: Theme.colors.gold
	},
	title: {marginTop: Theme.spacing.xs, fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, textAlign: "center", color: Theme.colors.ink},
	description: {
		marginTop: Theme.spacing.sm,
		marginBottom: Theme.spacing.xl,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		textAlign: "center",
		color: Theme.colors.muted
	},
	actions: {alignSelf: "stretch", gap: Theme.spacing.sm},
	later: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Theme.spacing.xs, paddingVertical: Theme.spacing.md},
	laterLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.bodySmall, color: Theme.colors.muted},
	pressed: {opacity: 0.6}
});

function between(value: Animated.Value, input: [number, number], output: [number, number]): Animated.AnimatedInterpolation<number> {
	return value.interpolate({inputRange: input, outputRange: output, extrapolate: "clamp"});
}

/** Whether the adventure tab is telling a story or asking something, which an unlock must not cover. */
export function useAdventureBusy(): boolean {
	const {open} = useCollectors();
	const outcomes = [
		useBigEventOutcome(), useLotteryOutcome(), useWitchOutcome(), useSmallEventChoiceOutcome(),
		useAutomaticSmallEventOutcome(), useTokenOutcome(), useHealOutcome(), useShopResult()
	];
	return open.length > 0 || outcomes.some(outcome => outcome !== null);
}

/** The emblem of what just opened pops out of a golden ring while sparks fly away from it. */
function UnlockEmblem({icon, burst}: {icon: string; burst: Animated.Value}): ReactNode {
	const halo = useMotionLoop(CELEBRATION_MOTION.haloMs, true);
	return <FarewellEmblem pulse={halo} haloColor={Theme.colors.goldWash}>
		<Animated.View style={[styles.ring, {
			opacity: between(burst, [0.2, 1], [0.9, 0]),
			transform: [{scale: between(burst, [0.2, 1], [0.6, CELEBRATION_MOTION.ringSpread])}]
		}]} />
		{SPARK_ANGLES.map(angle => <Animated.View key={angle} style={[styles.burst, {
			opacity: burst.interpolate({inputRange: [0, 0.3, 0.6, 1], outputRange: [0, 1, 1, 0]}),
			transform: [
				{translateX: between(burst, [0.25, 1], [0, Math.cos(angle) * CELEBRATION_MOTION.sparkReach])},
				{translateY: between(burst, [0.25, 1], [0, Math.sin(angle) * CELEBRATION_MOTION.sparkReach])}
			]
		}]}>
			<Sparkles size={CELEBRATION_MOTION.sparkSize} color={Theme.colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [{scale: burst.interpolate({inputRange: [0, 0.45, 0.75, 1], outputRange: [0.2, CELEBRATION_MOTION.emblemOvershoot, 0.95, 1]})}]}}>
			<TwemojiIcon emoji={AppIcons.getIcon(icon)} size={CELEBRATION_MOTION.emblem} />
		</Animated.View>
	</FarewellEmblem>;
}

/** A pet or a guild can open its tab before the level does: the level is only named when it is what opened it. */
function eyebrow(step: JourneyStep, level: number): string {
	return step.level !== undefined && level >= step.level ? i18n.t("app:journey.unlockedAtLevel", {level: step.level}) : i18n.t("app:journey.unlocked");
}

/** A card that bursts in over a dimmed screen, for the moments the game wants the player to stop on. */
export function Celebration({icon, eyebrow: caption, title, description, children, testID}: {
	icon: string;
	eyebrow: string;
	title: string;
	description?: string;
	children: ReactNode;
	testID?: string;
}): ReactNode {
	const reducedMotion = useReducedMotion();
	const [shown] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
	const [burst] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
	useEffect(() => {
		notificationAsync(NotificationFeedbackType.Success).catch(() => undefined);
		if (reducedMotion) return;
		Animated.sequence([
			Animated.timing(shown, {toValue: 1, duration: CELEBRATION_MOTION.backdropMs, easing: Easing.out(Easing.quad), useNativeDriver: true}),
			Animated.delay(CELEBRATION_MOTION.cardDelayMs),
			Animated.timing(burst, {toValue: 1, duration: CELEBRATION_MOTION.burstMs, easing: Easing.out(Easing.cubic), useNativeDriver: true})
		]).start();
	}, [burst, reducedMotion, shown]);
	return <View style={styles.layer} {...testID ? {testID} : {}} accessibilityViewIsModal>
		<Animated.View style={[styles.backdrop, {opacity: shown}]} />
		<Animated.View style={[styles.card, {
			opacity: shown,
			transform: [{scale: between(shown, [0, 1], [0.92, 1])}]
		}]}>
			<UnlockEmblem icon={icon} burst={burst} />
			<Text style={styles.eyebrow}>{caption}</Text>
			<Text style={styles.title}>{title}</Text>
			{description ? <Text style={styles.description}>{description}</Text> : null}
			<View style={styles.actions}>{children}</View>
		</Animated.View>
	</View>;
}

/**
 * A part of the game opening is a moment of its own: it takes the screen over the tabs, says what it
 * holds, and leads there at once or lets the player come back to it through the tab's mark.
 */
export function UnlockCelebration({step, level, onDiscover, onLater}: {step: JourneyStep; level: number; onDiscover: () => void; onLater: () => void}): ReactNode {
	return <Celebration
		icon={step.icon}
		eyebrow={eyebrow(step, level)}
		title={i18n.t(`app:journey.features.${step.feature}.title`)}
		description={i18n.t(`app:journey.features.${step.feature}.unlocked`)}
		testID="unlock-celebration"
	>
		<ActionBanner icon={ArrowRight} emoji={AppIcons.getIcon(step.icon)} label={i18n.t("app:journey.discover")} onPress={onDiscover} testID="unlock-discover" />
		<Pressable accessibilityRole="button" onPress={onLater} style={({pressed}): object[] => [styles.later, pressed && styles.pressed].filter(Boolean) as object[]}>
			<Text style={styles.laterLabel}>{i18n.t("app:journey.later")}</Text>
		</Pressable>
	</Celebration>;
}
