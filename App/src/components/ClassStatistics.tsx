import {ReactNode} from "react";
import {StyleSheet, Text, View} from "react-native";
import {ClassStats} from "ws-packets/src/objects/ClassDetails";
import {UnitIcon} from "@/src/components/UnitIcon";
import {Theme} from "@/src/design/Theme";
import {formatNumber, formatSignedNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {createStyles} from "@/src/design/ThemeContext";

export type ClassVitals = Pick<ClassStats, "health" | "attack" | "defense" | "speed" | "fightPoint" | "baseBreath" | "maxBreath" | "breathRegen">;

/** Each figure is named after the game unit it counts, so it can wear that unit's emoji. */
export const CLASS_STAT_FIELDS = [
	{field: "health", unit: "health"},
	{field: "fightPoint", unit: "energy"},
	{field: "attack", unit: "attack"},
	{field: "defense", unit: "defense"},
	{field: "speed", unit: "speed"},
	{field: "breathRegen", unit: "breathRegen"}
] as const;

export type ClassStatField = typeof CLASS_STAT_FIELDS[number];

const DELTA_WIDTH = 52;

const useStyles = createStyles(colors => ({
	line: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingVertical: Theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line},
	last: {borderBottomWidth: 0},
	label: {flex: 1, minWidth: 0, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.rowSubtitle, color: colors.muted},
	value: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, color: colors.ink, fontVariant: ["tabular-nums"]},
	delta: {width: DELTA_WIDTH, textAlign: "right", fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, color: colors.faint, fontVariant: ["tabular-nums"]},
	gain: {color: colors.green},
	loss: {color: colors.red}
}));

/** How far a class stands from the player's own on one figure, coloured by whether it would be a gain. */
export function StatDelta({value, reference}: {value: number; reference: number}): ReactNode {
	const styles = useStyles();
	const delta = value - reference;
	return <Text style={[styles.delta, delta > 0 && styles.gain, delta < 0 && styles.loss]}>{delta === 0 ? "" : formatSignedNumber(delta)}</Text>;
}

function StatLine({unit, label, value, last = false, children}: {unit: string; label: string; value: string; last?: boolean; children?: ReactNode}): ReactNode {
	const styles = useStyles();
	return <View style={[styles.line, last && styles.last]}>
		<UnitIcon unit={unit} size={15} />
		<Text style={styles.label} numberOfLines={1}>{label}</Text>
		<Text style={styles.value}>{value}</Text>
		{children}
	</View>;
}

/** One line per figure; given the player's own class, each line also says what changing would win or lose. */
export function ClassStatistics({stats, reference}: {stats: ClassVitals; reference?: ClassVitals}): ReactNode {
	return <View>
		{CLASS_STAT_FIELDS.map(stat => <StatLine key={stat.field} unit={stat.unit} label={i18n.t(`app:profile.fields.${stat.unit}`)} value={formatNumber(stats[stat.field])}>
			{reference ? <StatDelta value={stats[stat.field]} reference={reference[stat.field]} /> : null}
		</StatLine>)}
		<StatLine unit="breath" label={i18n.t("app:profile.fields.breath")} value={i18n.t("app:profile.formats.progress", {value: stats.baseBreath, max: stats.maxBreath})} last>
			{reference ? <StatDelta value={stats.maxBreath} reference={reference.maxBreath} /> : null}
		</StatLine>
	</View>;
}