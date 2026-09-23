import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import {AppIcons} from "@/src/AppIcons";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner} from "@/src/design/Sections";
import {Footprints, Gift, LucideIcon, PawPrint, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {i18n} from "@/src/translations/i18n";

const AWAY_MOTION = {
	swayMs: 1600,
	twinkleMs: 2400,
	float: -6,
	tilt: "9deg",
	haloGrowth: 1.06,
	dimSparkle: 0.2
} as const;

const EMBLEM = {area: 132, halo: 104, coin: 60, sparkle: 18} as const;

/** Where each sparkle sits around the coin, and when in the cycle it catches the light. */
const SPARKLES = [
	{style: {top: 10, left: 14}, phase: 0.05},
	{style: {top: 22, right: 8}, phase: 0.35},
	{style: {bottom: 12, left: 30}, phase: 0.65}
] as const;

/** Each sparkle brightens then fades over twice this share of the cycle, so a phase stays below 1 - 2 × span. */
const SPARKLE_FLASH_SPAN = 0.14;

const TIPS: {icon: LucideIcon; key: string}[] = [
	{icon: Gift, key: "app:adventure.tokens.away.dailyGift"},
	{icon: PawPrint, key: "app:adventure.tokens.away.expeditions"}
];

const styles = StyleSheet.create({
	page: {
		alignItems: "center",
		marginBottom: Theme.spacing.xl,
		paddingVertical: Theme.spacing.xxl,
		paddingHorizontal: Theme.spacing.xl,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	emblem: {width: EMBLEM.area, height: EMBLEM.area, alignItems: "center", justifyContent: "center", marginBottom: Theme.spacing.md},
	halo: {position: "absolute", width: EMBLEM.halo, height: EMBLEM.halo, borderRadius: EMBLEM.halo / 2, backgroundColor: Theme.colors.wash},
	sparkle: {position: "absolute"},
	eyebrow: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		letterSpacing: Theme.letterSpacing.eyebrow,
		textTransform: "uppercase",
		color: Theme.colors.gold
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
	tipIcon: {width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.greenWash},
	tipText: {flex: 1, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: Theme.colors.ink}
});

function useLoop(durationMs: number, back: boolean): Animated.Value {
	const reducedMotion = useReducedMotion();
	const [value] = useState(() => new Animated.Value(0));
	useEffect(() => {
		if (reducedMotion) {
			return undefined;
		}
		const timing = (toValue: number): Animated.CompositeAnimation => Animated.timing(value, {
			toValue, duration: durationMs, easing: back ? Easing.inOut(Easing.sin) : Easing.linear, useNativeDriver: true
		});
		const loop = Animated.loop(back ? Animated.sequence([timing(1), timing(0)]) : timing(1));
		loop.start();
		return (): void => loop.stop();
	}, [value, durationMs, back, reducedMotion]);
	return value;
}

function sparkleLight(twinkle: Animated.Value, phase: number): Animated.AnimatedInterpolation<number> {
	return twinkle.interpolate({
		inputRange: [0, phase, phase + SPARKLE_FLASH_SPAN, phase + SPARKLE_FLASH_SPAN * 2, 1],
		outputRange: [AWAY_MOTION.dimSparkle, AWAY_MOTION.dimSparkle, 1, AWAY_MOTION.dimSparkle, AWAY_MOTION.dimSparkle]
	});
}

/** The coin swings on its string like the sign of a stall about to close, while a few sparkles still catch the light. */
function AwayEmblem(): ReactNode {
	const sway = useLoop(AWAY_MOTION.swayMs, true);
	const twinkle = useLoop(AWAY_MOTION.twinkleMs, false);
	return <View style={styles.emblem}>
		<Animated.View style={[styles.halo, {transform: [{scale: sway.interpolate({inputRange: [0, 1], outputRange: [1, AWAY_MOTION.haloGrowth]})}]}]} />
		{SPARKLES.map(sparkle => <Animated.View
			key={sparkle.phase}
			style={[styles.sparkle, sparkle.style, {opacity: sparkleLight(twinkle, sparkle.phase), transform: [{scale: sparkleLight(twinkle, sparkle.phase)}]}]}
		>
			<Sparkles size={EMBLEM.sparkle} color={Theme.colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [
			{translateY: sway.interpolate({inputRange: [0, 1], outputRange: [0, AWAY_MOTION.float]})},
			{rotate: sway.interpolate({inputRange: [0, 1], outputRange: [`-${AWAY_MOTION.tilt}`, AWAY_MOTION.tilt]})}
		]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={EMBLEM.coin} />
		</Animated.View>
	</View>;
}

/** The merchant has sold every token the limits allow: a light-hearted farewell rather than a refusal. */
export function TokenMerchantAway({onContinue}: {onContinue: () => void}): ReactNode {
	return <Screen>
		<View style={styles.page}>
			<AwayEmblem />
			<Text style={styles.eyebrow}>{i18n.t("app:adventure.tokens.away.eyebrow")}</Text>
			<Text style={styles.title}>{i18n.t("app:adventure.tokens.away.title")}</Text>
			<Text style={styles.description}>{i18n.t("app:adventure.tokens.away.description")}</Text>
		</View>
		<View style={styles.tips}>
			<Text style={styles.tipsTitle}>{i18n.t("app:adventure.tokens.away.meanwhile")}</Text>
			{TIPS.map(({icon: Icon, key}) => <View key={key} style={styles.tip}>
				<View style={styles.tipIcon}><Icon size={16} color={Theme.colors.green} /></View>
				<Text style={styles.tipText}>{i18n.t(key)}</Text>
			</View>)}
		</View>
		<ActionBanner icon={Footprints} label={i18n.t("app:adventure.tokens.away.continue")} onPress={onContinue} />
	</Screen>;
}
