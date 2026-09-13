import {ReactNode, useEffect, useState} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import {LucideIcon, Wind} from "@/src/design/FightIcons";
import {FightFighter} from "ws-packets/src/objects/Fight";
import {Theme} from "@/src/design/Theme";
import {useCompactFight} from "@/src/components/FightControls";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const GAUGE_DURATION = 360;
const styles = StyleSheet.create({
	top: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 6},
	label: {fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.muted},
	value: {fontFamily: Theme.fonts.bold, fontSize: 11, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	track: {height: 6, backgroundColor: Theme.colors.line, borderRadius: 3, overflow: "hidden"},
	fill: {height: "100%", borderRadius: 3},
	resource: {marginTop: Theme.spacing.md, padding: Theme.spacing.md, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, backgroundColor: Theme.colors.wash},
	resourceTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, color: Theme.colors.ink},
	regen: {fontFamily: Theme.fonts.regular, fontSize: 10, color: Theme.colors.muted, marginTop: 6},
	compactResource: {padding: 9, marginTop: 8},
	meterLabel: {flexDirection: "row", alignItems: "center", gap: 5}
});

export function FightGauge({label, value, max, color, reducedMotion = false, icon: Icon}: {label: string; value: number; max?: number; color: string; reducedMotion?: boolean; icon?: LucideIcon}): ReactNode {
	const ratio = max ? Math.max(0, Math.min(1, value / max)) : 1;
	const [fill] = useState(() => new Animated.Value(ratio));
	useEffect(() => {
		const animation = Animated.timing(fill, {toValue: ratio, duration: reducedMotion ? 0 : GAUGE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false});
		animation.start();
		return (): void => animation.stop();
	}, [fill, ratio, reducedMotion]);
	return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{now: value, ...(max === undefined ? {} : {max})}}>
		<View style={styles.top}><View style={styles.meterLabel}>{Icon ? <Icon size={15} color={color} /> : null}<Text style={Icon ? styles.resourceTitle : styles.label}>{label}</Text></View><Text style={styles.value} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{max === undefined ? formatNumber(value) : i18n.t("app:profile.formats.progress", {value, max})}</Text></View>
		<View style={styles.track}><Animated.View style={[styles.fill, {backgroundColor: color, width: fill.interpolate({inputRange: [0, 1], outputRange: ["0%", "100%"]})}]} /></View>
	</View>;
}

export function FightBreath({fighter, reducedMotion}: {fighter: FightFighter; reducedMotion: boolean}): ReactNode {
	const compact = useCompactFight();
	return <View style={[styles.resource, compact && styles.compactResource]}>
		<FightGauge icon={Wind} label={i18n.t("app:arena.breath")} value={fighter.stats.breath} max={fighter.stats.maxBreath} color={Theme.colors.blue} reducedMotion={reducedMotion} />
		<Text style={styles.regen}>{i18n.t("app:battle.breathRegen", {count: fighter.stats.breathRegen})}</Text>
	</View>;
}