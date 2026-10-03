import {ReactNode} from "react";
import {Animated} from "react-native";
import {AppIcons} from "@/src/AppIcons";
import {cycleWindow, FarewellEmblem, useMotionLoop} from "@/src/design/Farewell";
import {Shield} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const BANNER_MOTION = {
	waveMs: 1800,
	rallyMs: 3000,
	lift: -5,
	tilt: "7deg",
	dimShield: 0.2,
	guild: 60,
	shield: 18
} as const;

/** The companions gathering around the banner, each showing up in turn. */
const SHIELDS = [
	{style: {top: 12, left: 12}, phase: 0.05},
	{style: {top: 24, right: 8}, phase: 0.3},
	{style: {bottom: 12, left: 28}, phase: 0.55}
] as const;

const SHIELD_FLASH_SPAN = 0.2;

const useStyles = createStyles(() => ({
	shield: {position: "absolute"}
}));

function shieldLight(rally: Animated.Value, phase: number): Animated.AnimatedInterpolation<number> {
	return cycleWindow(rally, {phase, span: SHIELD_FLASH_SPAN, rest: BANNER_MOTION.dimShield, peak: 1});
}

/** The guild banner waves while companions gather around it one after the other. */
export function GuildBannerEmblem({haloColor}: {haloColor?: string}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const wave = useMotionLoop(BANNER_MOTION.waveMs, true);
	const rally = useMotionLoop(BANNER_MOTION.rallyMs, false);
	return <FarewellEmblem pulse={wave} haloColor={haloColor ?? colors.wash}>
		{SHIELDS.map(shield => <Animated.View key={shield.phase} style={[styles.shield, shield.style, {opacity: shieldLight(rally, shield.phase)}]}>
			<Shield size={BANNER_MOTION.shield} color={colors.gold} />
		</Animated.View>)}
		<Animated.View style={{transform: [
			{translateY: wave.interpolate({inputRange: [0, 1], outputRange: [0, BANNER_MOTION.lift]})},
			{rotate: wave.interpolate({inputRange: [0, 1], outputRange: [`-${BANNER_MOTION.tilt}`, BANNER_MOTION.tilt]})}
		]}}>
			<TwemojiIcon emoji={AppIcons.getIcon("navigation.guild")} size={BANNER_MOTION.guild} />
		</Animated.View>
	</FarewellEmblem>;
}
