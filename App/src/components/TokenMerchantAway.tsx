import {ReactNode} from "react";
import {Animated, StyleSheet} from "react-native";
import {AppIcons} from "@/src/AppIcons";
import {Screen} from "@/src/design/Primitives";
import {ActionBanner} from "@/src/design/Sections";
import {
	cycleWindow, FAREWELL_TONES, FarewellEmblem, FarewellPage, FarewellTip, FarewellTips, useMotionLoop
} from "@/src/design/Farewell";
import {Footprints, Gift, PawPrint, Sparkles} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const AWAY_MOTION = {
	swayMs: 1600,
	twinkleMs: 2400,
	float: -6,
	tilt: "9deg",
	dimSparkle: 0.2,
	coin: 60,
	sparkle: 18
} as const;

/** Where each sparkle sits around the coin, and when in the cycle it catches the light. */
const SPARKLES = [
	{style: {top: 10, left: 14}, phase: 0.05},
	{style: {top: 22, right: 8}, phase: 0.35},
	{style: {bottom: 12, left: 30}, phase: 0.65}
] as const;

const SPARKLE_FLASH_SPAN = 0.14;

const styles = StyleSheet.create({
	sparkle: {position: "absolute"}
});

function tips(): FarewellTip[] {
	return [
		{icon: Gift, text: i18n.t("app:adventure.tokens.away.dailyGift"), tone: FAREWELL_TONES.GAIN},
		{icon: PawPrint, text: i18n.t("app:adventure.tokens.away.expeditions"), tone: FAREWELL_TONES.GAIN}
	];
}

function sparkleLight(twinkle: Animated.Value, phase: number): Animated.AnimatedInterpolation<number> {
	return cycleWindow(twinkle, {phase, span: SPARKLE_FLASH_SPAN, rest: AWAY_MOTION.dimSparkle, peak: 1});
}

/** The coin swings on its string like the sign of a stall about to close, while a few sparkles still catch the light. */
function AwayEmblem(): ReactNode {
	const sway = useMotionLoop(AWAY_MOTION.swayMs, true);
	const twinkle = useMotionLoop(AWAY_MOTION.twinkleMs, false);
	return <FarewellEmblem pulse={sway} haloColor={Theme.colors.wash}>
		{SPARKLES.map(sparkle => <Animated.View
			key={sparkle.phase}
			style={[styles.sparkle, sparkle.style, {opacity: sparkleLight(twinkle, sparkle.phase), transform: [{scale: sparkleLight(twinkle, sparkle.phase)}]}]}
		>
			<Sparkles size={AWAY_MOTION.sparkle} color={Theme.colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [
			{translateY: sway.interpolate({inputRange: [0, 1], outputRange: [0, AWAY_MOTION.float]})},
			{rotate: sway.interpolate({inputRange: [0, 1], outputRange: [`-${AWAY_MOTION.tilt}`, AWAY_MOTION.tilt]})}
		]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={AWAY_MOTION.coin} />
		</Animated.View>
	</FarewellEmblem>;
}

/** The merchant has sold every token the limits allow: a light-hearted farewell rather than a refusal. */
export function TokenMerchantAway({onContinue}: {onContinue: () => void}): ReactNode {
	return <Screen>
		<FarewellPage
			emblem={<AwayEmblem />}
			eyebrow={i18n.t("app:adventure.tokens.away.eyebrow")}
			eyebrowColor={Theme.colors.gold}
			title={i18n.t("app:adventure.tokens.away.title")}
			description={i18n.t("app:adventure.tokens.away.description")}
		/>
		<FarewellTips title={i18n.t("app:adventure.tokens.away.meanwhile")} tips={tips()} />
		<ActionBanner icon={Footprints} label={i18n.t("app:adventure.tokens.away.continue")} onPress={onContinue} />
	</Screen>;
}
