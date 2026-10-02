import {ReactNode} from "react";
import {View} from "react-native";
import {ClassStats} from "ws-packets/src/objects/ClassDetails";
import {StatDelta, StatLine} from "@/src/components/StatLine";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

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