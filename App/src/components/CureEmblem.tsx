import {ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {Animated, Easing, EasingFunction, Pressable, StyleSheet} from "react-native";
import {impactAsync, ImpactFeedbackStyle} from "expo-haptics";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useReducedMotion} from "@/src/store/useReducedMotion";

/** The ailment emoji the heal removes, and what happens once it is gone. */
export type Cure = {from: string; onDone: () => void};

const CURE_MOTION = {
	shakeStepMs: 55,
	shakes: 4,
	shakeTilt: "14deg",
	swapMs: 300,
	leaveScale: 0.2,
	leaveSpin: "220deg",
	arriveSpin: "-180deg",
	pulseMs: 140,
	pulses: 2,
	pulseScale: 1.22,
	ringMs: 480,
	ringFrom: 0.6,
	ringTo: 1.8,
	ringOpacity: 0.5,
	ringWidth: 3,
	burstMs: 620,
	burstRadius: 40,
	sparks: 10,
	sparkSize: 7,
	holdMs: 250
} as const;

/** The healthy face hops and wiggles, like a traveller in good spirits. */
const HAPPY_MOTION = {stepMs: 150, hop: -5, tilt: "10deg"} as const;

const EMBLEM_BOX = 48;

const styles = StyleSheet.create({
	box: {width: EMBLEM_BOX, height: EMBLEM_BOX, alignItems: "center", justifyContent: "center"},
	layer: {position: "absolute"},
	ring: {position: "absolute", width: EMBLEM_BOX, height: EMBLEM_BOX, borderRadius: EMBLEM_BOX / 2, borderWidth: CURE_MOTION.ringWidth},
	spark: {position: "absolute", width: CURE_MOTION.sparkSize, height: CURE_MOTION.sparkSize, borderRadius: CURE_MOTION.sparkSize / 2}
});

const SPARK_COLORS = [Theme.colors.gold, Theme.colors.green, Theme.colors.blue, Theme.colors.violet, Theme.colors.red];

function timing(value: Animated.Value, toValue: number, duration: number, easing: EasingFunction = Easing.inOut(Easing.quad)): Animated.CompositeAnimation {
	return Animated.timing(value, {toValue, duration, easing, useNativeDriver: true});
}

function fade(value: Animated.Value, inputRange: number[], outputRange: number[]): Animated.AnimatedInterpolation<number> {
	return value.interpolate({inputRange, outputRange, extrapolate: "clamp"});
}

function useHappyDance(): {wiggle: Animated.Value; dance: (onEnd?: () => void) => void} {
	const reducedMotion = useReducedMotion();
	const [wiggle] = useState(() => new Animated.Value(0));
	const dance = useCallback((onEnd?: () => void): void => {
		if (reducedMotion) {
			onEnd?.();
			return;
		}
		const step = (toValue: number, steps = 1): Animated.CompositeAnimation => timing(wiggle, toValue, HAPPY_MOTION.stepMs * steps);
		Animated.sequence([step(1), step(-1, 2), step(1, 2), step(0)]).start(() => onEnd?.());
	}, [reducedMotion, wiggle]);
	return {wiggle, dance};
}

function DanceMotion({wiggle, children}: {wiggle: Animated.Value; children: ReactNode}): ReactNode {
	return <Animated.View style={{transform: [
		{translateY: wiggle.interpolate({inputRange: [-1, 0, 1], outputRange: [HAPPY_MOTION.hop, 0, HAPPY_MOTION.hop]})},
		{rotate: wiggle.interpolate({inputRange: [-1, 1], outputRange: [`-${HAPPY_MOTION.tilt}`, HAPPY_MOTION.tilt]})}
	]}}>{children}</Animated.View>;
}

function Sparks({burst}: {burst: Animated.Value}): ReactNode {
	return Array.from({length: CURE_MOTION.sparks}, (_, index) => {
		const angle = 2 * Math.PI * index / CURE_MOTION.sparks;
		return <Animated.View
			key={index}
			pointerEvents="none"
			style={[styles.spark, {
				backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length],
				opacity: fade(burst, [0, 0.15, 1], [0, 1, 0]),
				transform: [
					{translateX: burst.interpolate({inputRange: [0, 1], outputRange: [0, Math.cos(angle) * CURE_MOTION.burstRadius]})},
					{translateY: burst.interpolate({inputRange: [0, 1], outputRange: [0, Math.sin(angle) * CURE_MOTION.burstRadius]})},
					{scale: fade(burst, [0, 0.3, 1], [0.4, 1, 0.5])}
				]
			}]}
		/>;
	});
}

type CureValues = Record<"shake" | "swap" | "pulse" | "ring" | "burst", Animated.Value>;

/** The hospital pulses like a siren; the healthy face arrives in a burst of colour. */
function flourish(values: CureValues, healed: boolean): Animated.CompositeAnimation {
	const ring = timing(values.ring, 1, CURE_MOTION.ringMs, Easing.out(Easing.quad));
	if (healed) {
		return Animated.parallel([ring, timing(values.burst, 1, CURE_MOTION.burstMs, Easing.out(Easing.cubic))]);
	}
	const pulses = Array.from({length: CURE_MOTION.pulses}, () => [timing(values.pulse, 1, CURE_MOTION.pulseMs), timing(values.pulse, 0, CURE_MOTION.pulseMs)]).flat();
	return Animated.parallel([ring, Animated.sequence(pulses)]);
}

function shakeOff(shake: Animated.Value): Animated.CompositeAnimation {
	const steps = Array.from({length: CURE_MOTION.shakes}, (_, index) => timing(shake, index % 2 === 0 ? 1 : -1, CURE_MOTION.shakeStepMs));
	return Animated.sequence([...steps, timing(shake, 0, CURE_MOTION.shakeStepMs)]);
}

/** The first emoji trembles; each next one spins in over the previous, then flourishes. */
function stageAnimation(values: CureValues, stage: number, last: number): Animated.CompositeAnimation {
	if (stage === 0) return shakeOff(values.shake);
	values.swap.setValue(0);
	values.ring.setValue(0);
	values.burst.setValue(0);
	return Animated.sequence([
		timing(values.swap, 1, CURE_MOTION.swapMs, Easing.out(Easing.back(1.6))),
		flourish(values, stage === last),
		Animated.delay(CURE_MOTION.holdMs)
	]);
}

function CureRing({ring, healed}: {ring: Animated.Value; healed: boolean}): ReactNode {
	return <Animated.View pointerEvents="none" style={[styles.ring, {
		borderColor: healed ? Theme.colors.green : Theme.colors.red,
		opacity: fade(ring, [0, 1], [CURE_MOTION.ringOpacity, 0]),
		transform: [{scale: ring.interpolate({inputRange: [0, 1], outputRange: [CURE_MOTION.ringFrom, CURE_MOTION.ringTo]})}]
	}]} />;
}

function LeavingEmoji({emoji, swap}: {emoji: string; swap: Animated.Value}): ReactNode {
	return <Animated.View style={[styles.layer, {
		opacity: fade(swap, [0, 1], [1, 0]),
		transform: [
			{scale: fade(swap, [0, 1], [1, CURE_MOTION.leaveScale])},
			{rotate: swap.interpolate({inputRange: [0, 1], outputRange: ["0deg", CURE_MOTION.leaveSpin]})}
		]
	}]}>
		<TwemojiIcon emoji={emoji} size={Theme.dimensions.headerIcon} />
	</Animated.View>;
}

function ArrivingEmoji({emoji, values, wiggle}: {emoji: string; values: CureValues; wiggle: Animated.Value}): ReactNode {
	return <Animated.View style={[styles.layer, {
		opacity: fade(values.swap, [0, 0.3], [0, 1]),
		transform: [
			{scale: values.swap},
			{rotate: values.swap.interpolate({inputRange: [0, 1], outputRange: [CURE_MOTION.arriveSpin, "0deg"]})},
			{rotate: values.shake.interpolate({inputRange: [-1, 1], outputRange: [`-${CURE_MOTION.shakeTilt}`, CURE_MOTION.shakeTilt]})},
			{scale: values.pulse.interpolate({inputRange: [0, 1], outputRange: [1, CURE_MOTION.pulseScale]})}
		]
	}]}>
		<DanceMotion wiggle={wiggle}>
			<TwemojiIcon emoji={emoji} size={Theme.dimensions.headerIcon} />
		</DanceMotion>
	</Animated.View>;
}

/** The ailment trembles and spins away as the hospital takes its place, which then gives way to the healthy face. */
export function CureEmblem({cure}: {cure: Cure}): ReactNode {
	const reducedMotion = useReducedMotion();
	const {wiggle, dance} = useHappyDance();
	const [values] = useState((): CureValues => ({
		shake: new Animated.Value(0),
		swap: new Animated.Value(1),
		pulse: new Animated.Value(0),
		ring: new Animated.Value(1),
		burst: new Animated.Value(0)
	}));
	const [stage, setStage] = useState(0);
	const stages = [cure.from, AppIcons.getIconOrNull("effects.healed"), AppIcons.getIconOrNull("effects.none")]
		.filter((emoji): emoji is string => Boolean(emoji));
	const last = stages.length - 1;
	const healed = stage === last && stage > 0;

	// Before paint, so the new emoji never shows at full size for a frame before it spins in.
	useLayoutEffect(() => {
		if (reducedMotion) {
			cure.onDone();
			return undefined;
		}
		const animation = stageAnimation(values, stage, last);
		animation.start(({finished}) => {
			if (!finished) return;
			if (stage < last) setStage(stage + 1);
			else dance(cure.onDone);
		});
		return (): void => animation.stop();
	}, [cure, dance, last, reducedMotion, stage, values]);

	const leaving = stage > 0 ? stages[stage - 1] : null;
	return <Animated.View style={styles.box}>
		<CureRing ring={values.ring} healed={healed} />
		{healed ? <Sparks burst={values.burst} /> : null}
		{leaving ? <LeavingEmoji emoji={leaving} swap={values.swap} /> : null}
		<ArrivingEmoji emoji={stages[stage]} values={values} wiggle={wiggle} />
	</Animated.View>;
}

/** Touching the healthy face makes it dance; ten seconds of frantic tapping make it blow up, then come back. */
const EASTER_EGG = {spamMs: 10_000, maxGapMs: 700, blastMs: 650, blastScale: 2.4, swellScale: 1.6, goneMs: 3_000, returnMs: 420} as const;

type HappyPhase = "happy" | "blast" | "gone";

export function HappyEmblem({emoji}: {emoji: string}): ReactNode {
	const reducedMotion = useReducedMotion();
	const {wiggle, dance} = useHappyDance();
	const [phase, setPhase] = useState<HappyPhase>("happy");
	const [blast] = useState(() => new Animated.Value(0));
	const [comeback] = useState(() => new Animated.Value(1));
	const streak = useRef({start: 0, last: 0});
	const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => (): void => {
		if (returnTimer.current) clearTimeout(returnTimer.current);
	}, []);

	const comeBack = (): void => {
		comeback.setValue(reducedMotion ? 1 : 0);
		setPhase("happy");
		timing(comeback, 1, EASTER_EGG.returnMs, Easing.out(Easing.back(2))).start();
	};
	const explode = (): void => {
		streak.current = {start: 0, last: 0};
		blast.setValue(0);
		setPhase("blast");
		impactAsync(ImpactFeedbackStyle.Heavy).catch(() => undefined);
		timing(blast, 1, reducedMotion ? 0 : EASTER_EGG.blastMs, Easing.out(Easing.cubic)).start(() => {
			setPhase("gone");
			returnTimer.current = setTimeout(comeBack, EASTER_EGG.goneMs);
		});
	};
	const press = (): void => {
		if (phase !== "happy") return;
		const now = Date.now();
		const tapping = streak.current;
		if (now - tapping.last > EASTER_EGG.maxGapMs) tapping.start = now;
		tapping.last = now;
		if (now - tapping.start >= EASTER_EGG.spamMs) explode();
		else dance();
	};

	const face = <TwemojiIcon emoji={emoji} size={Theme.dimensions.headerIcon} />;
	const explosion = AppIcons.getIconOrNull("other.explosion");
	return <Pressable onPress={press} testID="happy-emblem" style={styles.box}>
		{phase === "happy" ? <Animated.View style={{opacity: comeback, transform: [{scale: comeback}]}}>
			<DanceMotion wiggle={wiggle}>{face}</DanceMotion>
		</Animated.View> : null}
		{phase === "blast" ? <>
			<Animated.View style={[styles.layer, {
				opacity: fade(blast, [0, 0.35], [1, 0]),
				transform: [{scale: fade(blast, [0, 0.35], [1, EASTER_EGG.swellScale])}]
			}]}>{face}</Animated.View>
			<Sparks burst={blast} />
			{explosion ? <Animated.View style={[styles.layer, {
				opacity: fade(blast, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
				transform: [{scale: fade(blast, [0, 1], [0.3, EASTER_EGG.blastScale])}]
			}]}>
				<TwemojiIcon emoji={explosion} size={Theme.dimensions.headerIcon} />
			</Animated.View> : null}
		</> : null}
	</Pressable>;
}
