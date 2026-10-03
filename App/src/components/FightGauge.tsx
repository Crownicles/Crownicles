import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, Text, View} from "react-native";
import {LucideIcon} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {splitLeadingEmoji, TwemojiText} from "@/src/design/TwemojiText";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {createStyles} from "@/src/design/ThemeContext";

const GAUGE_DURATION = 360;
const useStyles = createStyles(colors => ({
	top: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 6},
	label: {fontFamily: Theme.fonts.medium, fontSize: 10, color: colors.muted},
	value: {fontFamily: Theme.fonts.bold, fontSize: 12, color: colors.ink, fontVariant: ["tabular-nums"]},
	track: {height: 8, backgroundColor: colors.line, borderRadius: 4, overflow: "hidden"},
	fill: {height: "100%", borderRadius: 4},
	lossTrail: {position: "absolute", top: 0, left: 0, opacity: 0.28},
	resourceTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, color: colors.ink},
	meterLabel: {flexDirection: "row", alignItems: "center", gap: 5}
}));

const LABEL_ICON_SIZE = 15;
const LABEL_EMOJI_SIZE = 12;

/** Game texts open with their emoji: a line icon replaces it, otherwise it takes the icon slot, and the label its title style. */
function GaugeLabel({label, color, icon: Icon, emoji}: {label: string; color: string; icon?: LucideIcon; emoji?: string}): ReactNode {
	const styles = useStyles();
	const {emoji: leading, text} = splitLeadingEmoji(label);
	const drawn = Icon ? undefined : emoji ?? leading;
	return <View style={styles.meterLabel}>
		{Icon ? <Icon size={LABEL_ICON_SIZE} color={color} /> : null}
		{drawn ? <TwemojiIcon emoji={drawn} size={LABEL_ICON_SIZE} /> : null}
		<TwemojiText textStyle={Icon ?? drawn ? styles.resourceTitle : styles.label} emojiSize={LABEL_EMOJI_SIZE}>{text}</TwemojiText>
	</View>;
}

export function FightGauge({label, value, max, color, reducedMotion = false, icon, emoji}: {label: string; value: number; max?: number; color: string; reducedMotion?: boolean; icon?: LucideIcon; emoji?: string}): ReactNode {
	const styles = useStyles();
	const ratio = max ? Math.max(0, Math.min(1, value / max)) : 1;
	const [fill] = useState(() => new Animated.Value(ratio));
	useEffect(() => {
		const animation = Animated.timing(fill, {toValue: ratio, duration: reducedMotion ? 0 : GAUGE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false});
		animation.start();
		return (): void => animation.stop();
	}, [fill, ratio, reducedMotion]);
	return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{now: value, ...(max === undefined ? {} : {max})}}>
		<View style={styles.top}><GaugeLabel label={label} color={color} {...icon ? {icon} : {}} {...emoji ? {emoji} : {}} /><Text style={styles.value} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{max === undefined ? formatNumber(value) : i18n.t("app:profile.formats.progress", {value, max})}</Text></View>
		<View style={styles.track}>
			<Animated.View style={[styles.fill, styles.lossTrail, {backgroundColor: color, width: fill.interpolate({inputRange: [0, 1], outputRange: ["0%", "100%"]})}]} />
			<View testID="fight-gauge-fill" style={[styles.fill, {backgroundColor: color, width: `${ratio * 100}%`}]} />
		</View>
	</View>;
}
