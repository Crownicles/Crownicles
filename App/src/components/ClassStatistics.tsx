import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {ClassStats} from "ws-packets/src/objects/ClassDetails";
import {UnitIcon} from "@/src/components/UnitIcon";
import {Theme} from "@/src/design/Theme";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

export type ClassVitals = Pick<ClassStats, "health" | "attack" | "defense" | "speed" | "fightPoint" | "baseBreath" | "maxBreath" | "breathRegen">;

/** Each figure is named after the game unit it counts, so it can wear that unit's emoji. */
const STAT_FIELDS = [
	{field: "health", unit: "health"},
	{field: "fightPoint", unit: "energy"},
	{field: "attack", unit: "attack"},
	{field: "defense", unit: "defense"},
	{field: "speed", unit: "speed"},
	{field: "breathRegen", unit: "breathRegen"}
] as const;

const styles = StyleSheet.create({
	stats: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.sm},
	stat: {flexGrow: 1, flexBasis: "30%", alignItems: "center", gap: 2, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.xs, backgroundColor: Theme.colors.paper, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: 10},
	value: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	label: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, color: Theme.colors.muted, textAlign: "center"}
});

export function ClassStatistics({stats}: {stats: ClassVitals}): ReactNode {
	return <View style={styles.stats}>
		{STAT_FIELDS.map(stat => <View key={stat.field} style={styles.stat}>
			<UnitIcon unit={stat.unit} size={15} />
			<Text style={styles.value}>{formatNumber(stats[stat.field])}</Text>
			<Text style={styles.label} numberOfLines={1}>{i18n.t(`app:profile.fields.${stat.unit}`)}</Text>
		</View>)}
		<View style={styles.stat}>
			<UnitIcon unit="breath" size={15} />
			<Text style={styles.value}>{i18n.t("app:profile.formats.progress", {value: stats.baseBreath, max: stats.maxBreath})}</Text>
			<Text style={styles.label} numberOfLines={1}>{i18n.t("app:profile.fields.breath")}</Text>
		</View>
	</View>;
}