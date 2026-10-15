import { ReactNode } from "react";
import { Animated } from "react-native";
import { AppIcons } from "@/src/AppIcons";
import { Screen } from "@/src/design/Primitives";
import { ActionBanner } from "@/src/design/Sections";
import {
	FAREWELL_TONES, FarewellEmblem, FarewellPage, FarewellSparkles, FarewellTip, FarewellTips, useMotionLoop
} from "@/src/design/Farewell";
import {
	Footprints, Gift, PawPrint
} from "@/src/design/FightIcons";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { i18n } from "@/src/translations/i18n";
import { useColors } from "@/src/design/ThemeContext";

const AWAY_MOTION = {
	swayMs: 1600,
	float: -6,
	tilt: "9deg",
	coin: 60
} as const;

function tips(): FarewellTip[] {
	return [
		{
			icon: Gift, text: i18n.t("app:adventure.tokens.away.dailyGift"), tone: FAREWELL_TONES.GAIN
		},
		{
			icon: PawPrint, text: i18n.t("app:adventure.tokens.away.expeditions"), tone: FAREWELL_TONES.GAIN
		}
	];
}

/** The coin swings on its string like the sign of a stall about to close, while a few sparkles still catch the light. */
function AwayEmblem(): ReactNode {
	const colors = useColors();
	const sway = useMotionLoop(AWAY_MOTION.swayMs, true);
	return <FarewellEmblem pulse={sway} haloColor={colors.wash}>
		<FarewellSparkles />
		<Animated.View style={{ transform: [
			{ translateY: sway.interpolate({
				inputRange: [0, 1], outputRange: [0, AWAY_MOTION.float]
			}) },
			{ rotate: sway.interpolate({
				inputRange: [0, 1], outputRange: [`-${AWAY_MOTION.tilt}`, AWAY_MOTION.tilt]
			}) }
		] }}>
			<TwemojiIcon emoji={AppIcons.getIcon("unitValues.token")} size={AWAY_MOTION.coin} />
		</Animated.View>
	</FarewellEmblem>;
}

/** The merchant has sold every token the limits allow: a light-hearted farewell rather than a refusal. */
export function TokenMerchantAway({ onContinue }: { onContinue: () => void }): ReactNode {
	const colors = useColors();
	return <Screen>
		<FarewellPage
			emblem={<AwayEmblem />}
			eyebrow={i18n.t("app:adventure.tokens.away.eyebrow")}
			eyebrowColor={colors.gold}
			title={i18n.t("app:adventure.tokens.away.title")}
			description={i18n.t("app:adventure.tokens.away.description")}
		/>
		<FarewellTips title={i18n.t("app:adventure.tokens.away.meanwhile")} tips={tips()} />
		<ActionBanner icon={Footprints} label={i18n.t("app:adventure.tokens.away.continue")} onPress={onContinue} />
	</Screen>;
}
