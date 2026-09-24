import {ReactNode, useEffect, useRef, useState} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppIcons} from "@/src/AppIcons";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner} from "@/src/design/Sections";
import {
	cycleWindow, FAREWELL_TONES, FarewellEmblem, FarewellPage, FarewellTip, FarewellTips, useMotionLoop
} from "@/src/design/Farewell";
import {Footprints, HeartPulse, Medal, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useRespawn} from "@/src/components/Utilities";
import {formatNumber} from "@/src/display/Amounts";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {i18n} from "@/src/translations/i18n";

const DEATH_MOTION = {
	driftMs: 2600,
	wispMs: 3200,
	float: -5,
	skull: 58,
	wisp: 7,
	wispRise: -28,
	wispPeak: 0.55
} as const;

/** The resurrection played between the press and the request: the skull shudders, bursts, and a heart rises in its place. */
const REVIVAL_MOTION = {
	shakeMs: 360,
	bloomMs: 900,
	skullBurst: 1.5,
	heartOvershoot: 1.25,
	ring: 96,
	ringSpread: 3.2,
	sparkRise: -70,
	sparkSize: 18,
	flashPeak: 0.45
} as const;

/** Where each wisp leaves the skull, and when in the cycle it drifts away. */
const WISPS = [
	{style: {bottom: 34, left: 38}, phase: 0.05},
	{style: {bottom: 40, right: 36}, phase: 0.36},
	{style: {bottom: 30, left: 62}, phase: 0.67}
] as const;

const WISP_SPAN = 0.14;

/** Sideways drift of each spark flying out of the resurrection. */
const SPARKS = [-54, -24, 8, 36, 60] as const;

const styles = StyleSheet.create({
	backdrop: {flex: 1, backgroundColor: Theme.colors.wash},
	content: {flexGrow: 1, justifyContent: "center"},
	wisp: {position: "absolute", width: DEATH_MOTION.wisp, height: DEATH_MOTION.wisp, borderRadius: DEATH_MOTION.wisp / 2, backgroundColor: Theme.colors.muted},
	layer: {position: "absolute", alignItems: "center", justifyContent: "center"},
	ring: {position: "absolute", width: REVIVAL_MOTION.ring, height: REVIVAL_MOTION.ring, borderRadius: REVIVAL_MOTION.ring / 2, borderWidth: 3, borderColor: Theme.colors.green},
	lifeHalo: {position: "absolute", width: 104, height: 104, borderRadius: 52, backgroundColor: Theme.colors.greenWash},
	flash: {position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Theme.colors.greenWash},
	stake: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	stakeCaption: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink},
	stakeValue: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.xs},
	stakeAmount: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: Theme.colors.red, fontVariant: ["tabular-nums"]}
});

function comebackTips(): FarewellTip[] {
	return [
		{icon: HeartPulse, text: i18n.t("app:death.health"), tone: FAREWELL_TONES.GAIN},
		{icon: Footprints, text: i18n.t("app:death.journey"), tone: FAREWELL_TONES.GAIN},
		{icon: Medal, text: i18n.t("app:utilities.respawnWarning"), tone: FAREWELL_TONES.LOSS}
	];
}

function between(value: Animated.Value, input: [number, number], output: [number, number]): Animated.AnimatedInterpolation<number> {
	return value.interpolate({inputRange: input, outputRange: output, extrapolate: "clamp"});
}

/** Green life takes over the red halo, a ring bursts outwards and sparks fly up while the heart replaces the skull. */
function RevivalBloom({bloom}: {bloom: Animated.Value}): ReactNode {
	return <>
		<Animated.View style={[styles.lifeHalo, {opacity: between(bloom, [0, 0.5], [0, 1])}]} />
		<Animated.View style={[styles.ring, {
			opacity: between(bloom, [0.3, 1], [0.9, 0]),
			transform: [{scale: between(bloom, [0.3, 1], [0.5, REVIVAL_MOTION.ringSpread])}]
		}]} />
		{SPARKS.map(drift => <Animated.View key={drift} style={[styles.layer, {
			opacity: bloom.interpolate({inputRange: [0, 0.45, 0.7, 1], outputRange: [0, 0, 1, 0]}),
			transform: [
				{translateX: between(bloom, [0.45, 1], [0, drift])},
				{translateY: between(bloom, [0.45, 1], [0, REVIVAL_MOTION.sparkRise])}
			]
		}]}>
			<Sparkles size={REVIVAL_MOTION.sparkSize} color={Theme.colors.gold} />
		</Animated.View>)}
		<Animated.View style={[styles.layer, {
			opacity: between(bloom, [0.35, 0.65], [0, 1]),
			transform: [{scale: bloom.interpolate({inputRange: [0, 0.35, 0.75, 1], outputRange: [0.3, 0.3, REVIVAL_MOTION.heartOvershoot, 1]})}]
		}]}>
			<TwemojiIcon emoji={AppIcons.getIcon("unitValues.health")} size={DEATH_MOTION.skull} />
		</Animated.View>
	</>;
}

/** The skull hovers while faint wisps slip away from it; once the player gets up, it shudders and gives way to a heart. */
function DeathEmblem({shake, bloom}: {shake: Animated.Value; bloom: Animated.Value}): ReactNode {
	const drift = useMotionLoop(DEATH_MOTION.driftMs, true);
	const wisps = useMotionLoop(DEATH_MOTION.wispMs, false);
	return <FarewellEmblem pulse={drift} haloColor={Theme.colors.redWash}>
		{WISPS.map(wisp => <Animated.View key={wisp.phase} style={[styles.wisp, wisp.style, {
			opacity: cycleWindow(wisps, {phase: wisp.phase, span: WISP_SPAN, rest: 0, peak: DEATH_MOTION.wispPeak}),
			transform: [{translateY: wisps.interpolate({
				inputRange: [0, wisp.phase, wisp.phase + WISP_SPAN * 2, 1],
				outputRange: [0, 0, DEATH_MOTION.wispRise, DEATH_MOTION.wispRise]
			})}]
		}]} />)}
		<RevivalBloom bloom={bloom} />
		<Animated.View style={{
			opacity: between(bloom, [0, 0.4], [1, 0]),
			transform: [
				{translateY: drift.interpolate({inputRange: [0, 1], outputRange: [0, DEATH_MOTION.float]})},
				{rotate: shake.interpolate({inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: ["0deg", "-14deg", "12deg", "-9deg", "6deg", "0deg"]})},
				{scale: between(bloom, [0, 0.4], [1, REVIVAL_MOTION.skullBurst])}
			]
		}}>
			<TwemojiIcon emoji={AppIcons.getIcon("effects.dead")} size={DEATH_MOTION.skull} />
		</Animated.View>
	</FarewellEmblem>;
}

/** Plays the resurrection before sending the request, and rewinds it when the request fails. */
function useRevival(respawn: () => void, failure: string | null): {shake: Animated.Value; bloom: Animated.Value; revive: () => void; reviving: boolean} {
	const reducedMotion = useReducedMotion();
	const [shake] = useState(() => new Animated.Value(0));
	const [bloom] = useState(() => new Animated.Value(0));
	const [started, setStarted] = useState(false);
	const animating = useRef(false);
	useEffect(() => {
		if (failure) {
			shake.setValue(0);
			bloom.setValue(0);
		}
	}, [failure, shake, bloom]);
	const revive = (): void => {
		if (animating.current) return;
		setStarted(true);
		if (reducedMotion) {
			respawn();
			return;
		}
		animating.current = true;
		Animated.sequence([
			Animated.timing(shake, {toValue: 1, duration: REVIVAL_MOTION.shakeMs, easing: Easing.linear, useNativeDriver: true}),
			Animated.timing(bloom, {toValue: 1, duration: REVIVAL_MOTION.bloomMs, easing: Easing.out(Easing.cubic), useNativeDriver: true})
		]).start(({finished}) => {
			animating.current = false;
			if (finished) respawn();
		});
	};
	return {shake, bloom, revive, reviving: started && failure === null};
}

/** What getting back up costs, stated in points before the player commits. */
function ScoreStake({scoreLoss}: {scoreLoss: number}): ReactNode {
	return <View style={styles.stake}>
		<Text style={styles.stakeCaption}>{i18n.t("app:death.scoreLossCaption")}</Text>
		<View style={styles.stakeValue}>
			<Text style={styles.stakeAmount}>{`−${formatNumber(scoreLoss)}`}</Text>
			<TwemojiIcon emoji={AppIcons.getIcon("unitValues.score")} size={Theme.fontSize.title} />
		</View>
	</View>;
}

/** A dead character can do nothing but get back up, so the whole screen is given to that single choice. */
export function DeathScreen(): ReactNode {
	const insets = useSafeAreaInsets();
	const profile = usePlayerProfile();
	const scoreLoss = profile.status === "ready" ? profile.data.effect.respawnScoreLoss : undefined;
	const {pending, message, respawn} = useRespawn();
	const {shake, bloom, revive, reviving} = useRevival(respawn, message);
	return <View style={[styles.backdrop, {paddingTop: insets.top, paddingBottom: insets.bottom}]} testID="death-screen">
		<Screen contentContainerStyle={styles.content}>
			<FarewellPage
				emblem={<DeathEmblem shake={shake} bloom={bloom} />}
				eyebrow={i18n.t("app:death.eyebrow")}
				eyebrowColor={Theme.colors.red}
				title={i18n.t("error:effects.dead.self")}
				description={i18n.t("app:death.description")}
			/>
			{scoreLoss === undefined ? null : <ScoreStake scoreLoss={scoreLoss} />}
			<FarewellTips title={i18n.t("app:death.comeback")} tips={comebackTips()} />
			<ActionBanner icon={HeartPulse} label={i18n.t("app:utilities.respawn")} pending={pending || reviving} onPress={revive} />
			{message ? <Note>{message}</Note> : null}
		</Screen>
		<Animated.View pointerEvents="none" style={[styles.flash, {opacity: bloom.interpolate({inputRange: [0, 0.4, 1], outputRange: [0, REVIVAL_MOTION.flashPeak, 0]})}]} />
	</View>;
}
