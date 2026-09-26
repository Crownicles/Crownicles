import {ReactNode, useEffect, useRef, useState} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {notificationAsync, NotificationFeedbackType} from "expo-haptics";
import {AppIcons} from "@/src/AppIcons";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner} from "@/src/design/Sections";
import {cycleWindow, FarewellEmblem, FarewellPage, useMotionLoop} from "@/src/design/Farewell";
import {Clock3, Footprints, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useReportAdvance} from "@/src/store/useReportActions";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {i18n} from "@/src/translations/i18n";

const WELCOME_MOTION = {
	floatMs: 2800,
	twinkleMs: 2600,
	float: -6,
	crown: 62,
	twinkleSpan: 0.14,
	riseMs: 420,
	riseOffset: 24,
	riseStaggerMs: 110
} as const;

/** The traveller walks out of the village before the first report is sent. */
const DEPARTURE_MOTION = {durationMs: 1_300, strideMs: 110, hop: -7, lean: "10deg"} as const;

/** Where each spark glints around the crown, and when in the cycle. */
const TWINKLES = [
	{style: {top: 10, left: 18}, phase: 0.04, size: 18},
	{style: {top: 30, right: 10}, phase: 0.32, size: 14},
	{style: {bottom: 16, left: 26}, phase: 0.58, size: 12}
] as const;

const RHYTHM_ICON = 32;

const styles = StyleSheet.create({
	backdrop: {flex: 1, backgroundColor: Theme.colors.wash},
	centered: {justifyContent: "center"},
	twinkle: {position: "absolute"},
	rhythm: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, padding: Theme.spacing.lg, borderRadius: Theme.radius, backgroundColor: Theme.colors.paper},
	rhythmIcon: {width: RHYTHM_ICON, height: RHYTHM_ICON, borderRadius: RHYTHM_ICON / 2, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.goldWash},
	rhythmText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: Theme.colors.ink},
	road: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.md,
		paddingTop: Theme.spacing.xl + Theme.spacing.sm,
		paddingBottom: Theme.spacing.lg,
		paddingHorizontal: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	track: {flex: 1, height: 6, borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.line},
	trackFill: {height: "100%", borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.gold},
	runner: {position: "absolute", top: -Theme.dimensions.headerIcon + Theme.spacing.xs, marginLeft: -Theme.dimensions.quickActionIcon / 2},
	footer: {
		paddingTop: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.xl,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: Theme.colors.line,
		backgroundColor: Theme.colors.wash
	}
});

/** A block of the page sliding up into place a little after the one above it. */
function Rise({order, children}: {order: number; children: ReactNode}): ReactNode {
	const reducedMotion = useReducedMotion();
	const [shown] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
	useEffect(() => {
		if (reducedMotion) return;
		Animated.timing(shown, {
			toValue: 1,
			duration: WELCOME_MOTION.riseMs,
			delay: order * WELCOME_MOTION.riseStaggerMs,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true
		}).start();
	}, [order, reducedMotion, shown]);
	return <Animated.View style={{
		opacity: shown,
		transform: [{translateY: shown.interpolate({inputRange: [0, 1], outputRange: [WELCOME_MOTION.riseOffset, 0]})}]
	}}>{children}</Animated.View>;
}

/** The crown hovers over a golden halo while sparks glint around it. */
function WelcomeEmblem(): ReactNode {
	const float = useMotionLoop(WELCOME_MOTION.floatMs, true);
	const twinkle = useMotionLoop(WELCOME_MOTION.twinkleMs, false);
	return <FarewellEmblem pulse={float} haloColor={Theme.colors.goldWash}>
		{TWINKLES.map(spark => <Animated.View key={spark.phase} style={[styles.twinkle, spark.style, {
			opacity: cycleWindow(twinkle, {phase: spark.phase, span: WELCOME_MOTION.twinkleSpan, rest: 0.35, peak: 1}),
			transform: [{scale: cycleWindow(twinkle, {phase: spark.phase, span: WELCOME_MOTION.twinkleSpan, rest: 0.7, peak: 1.2})}]
		}]}>
			<Sparkles size={spark.size} color={Theme.colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [{translateY: float.interpolate({inputRange: [0, 1], outputRange: [0, WELCOME_MOTION.float]})}]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("other.crown")} size={WELCOME_MOTION.crown} />
		</Animated.View>
	</FarewellEmblem>;
}

/** The one rule a newcomer must know: the journey goes on while the app is closed. */
function Rhythm(): ReactNode {
	return <View style={styles.rhythm}>
		<View style={styles.rhythmIcon}><Clock3 size={16} color={Theme.colors.gold} /></View>
		<Text style={styles.rhythmText}>{i18n.t("app:welcome.rhythm")}</Text>
	</View>;
}

/** The road out of the village, with the traveller waiting at its start until the player sets off. */
function DepartureRoad({progress, stride}: {progress: Animated.Value; stride: Animated.Value}): ReactNode {
	const position = progress.interpolate({inputRange: [0, 1], outputRange: ["0%", "100%"]});
	return <View accessible accessibilityLabel={i18n.t("app:welcome.road")} style={styles.road}>
		<TwemojiIcon emoji={AppIcons.getIcon("mapTypes.vi")} size={Theme.dimensions.headerIcon} />
		<View style={styles.track}>
			<Animated.View style={[styles.trackFill, {width: position}]} />
			<Animated.View style={[styles.runner, {left: position}]}>
				{/* Twemoji draws the walker heading left, so it is mirrored to face the castle. */}
				<Animated.View style={{transform: [
					{translateY: stride.interpolate({inputRange: [0, 1], outputRange: [0, DEPARTURE_MOTION.hop]})},
					{rotate: stride.interpolate({inputRange: [0, 1], outputRange: ["0deg", DEPARTURE_MOTION.lean]})},
					{scaleX: -1}
				]}}>
					<TwemojiIcon emoji={AppIcons.getIcon("other.walking")} size={Theme.dimensions.quickActionIcon} />
				</Animated.View>
			</Animated.View>
		</View>
		<TwemojiIcon emoji={AppIcons.getIcon("mapTypes.castleEntrance")} size={Theme.dimensions.headerIcon} />
	</View>;
}

/** Walks the traveller down the road, then sends the first report; a refusal brings them back to the village. */
function useDeparture(start: () => void, failure: string | null): {progress: Animated.Value; stride: Animated.Value; depart: () => void; leaving: boolean} {
	const reducedMotion = useReducedMotion();
	const [progress] = useState(() => new Animated.Value(0));
	const [stride] = useState(() => new Animated.Value(0));
	const [started, setStarted] = useState(false);
	const walking = useRef(false);
	useEffect(() => {
		if (failure) progress.setValue(0);
	}, [failure, progress]);
	const depart = (): void => {
		if (walking.current) return;
		setStarted(true);
		notificationAsync(NotificationFeedbackType.Success).catch(() => undefined);
		if (reducedMotion) {
			start();
			return;
		}
		walking.current = true;
		progress.setValue(0);
		const strides = Animated.loop(Animated.sequence([
			Animated.timing(stride, {toValue: 1, duration: DEPARTURE_MOTION.strideMs, easing: Easing.out(Easing.quad), useNativeDriver: true}),
			Animated.timing(stride, {toValue: 0, duration: DEPARTURE_MOTION.strideMs, easing: Easing.in(Easing.quad), useNativeDriver: true})
		]));
		strides.start();
		Animated.timing(progress, {toValue: 1, duration: DEPARTURE_MOTION.durationMs, easing: Easing.inOut(Easing.cubic), useNativeDriver: false}).start(() => {
			walking.current = false;
			strides.stop();
			stride.setValue(0);
			start();
		});
	};
	return {progress, stride, depart, leaving: started && failure === null};
}

/**
 * The adventure tab of a character who has not set off yet: only what matters now, the rule of the
 * game's rhythm and the road the first report opens. What the game holds next is revealed as it opens.
 */
export function AdventureWelcome(): ReactNode {
	const insets = useSafeAreaInsets();
	const reportAction = useReportAdvance();
	const {progress, stride, depart, leaving} = useDeparture((): void => {
		reportAction.submit().catch(console.error);
	}, reportAction.message);
	return <View style={styles.backdrop} testID="adventure-welcome">
		<Screen contentContainerStyle={styles.centered}>
			<Rise order={0}>
				<FarewellPage
					emblem={<WelcomeEmblem />}
					eyebrow={i18n.t("app:welcome.eyebrow")}
					eyebrowColor={Theme.colors.gold}
					title={i18n.t("app:welcome.title")}
					description={i18n.t("app:welcome.description")}
				/>
			</Rise>
			<Rise order={1}><Rhythm /></Rise>
		</Screen>
		{/* Pinned so setting off never needs a scroll; with no tab bar yet, it clears the home indicator itself. */}
		<Rise order={2}>
			<View style={[styles.footer, {paddingBottom: Theme.spacing.md + insets.bottom}]}>
				<DepartureRoad progress={progress} stride={stride} />
				<ActionBanner icon={Footprints} label={i18n.t("app:welcome.depart")} pending={reportAction.pending || leaving} onPress={depart} testID="welcome-depart" />
				{reportAction.message ? <Note>{reportAction.message}</Note> : null}
			</View>
		</Rise>
	</View>;
}
