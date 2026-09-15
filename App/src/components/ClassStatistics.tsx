import {ReactNode} from "react";
import {ClassStats} from "ws-packets/src/objects/ClassDetails";
import {KeyValue, Panel} from "@/src/design/Primitives";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

export type ClassVitals = Pick<ClassStats, "health" | "attack" | "defense" | "speed" | "fightPoint" | "baseBreath" | "maxBreath" | "breathRegen">;

const STAT_FIELDS = [
	{field: "health", label: "health"},
	{field: "fightPoint", label: "energy"},
	{field: "attack", label: "attack"},
	{field: "defense", label: "defense"},
	{field: "speed", label: "speed"},
	{field: "breathRegen", label: "breathRegen"}
] as const;

export function ClassStatistics({stats}: {stats: ClassVitals}): ReactNode {
	return <Panel>
		{STAT_FIELDS.map(stat => <KeyValue key={stat.field} label={i18n.t(`app:profile.fields.${stat.label}`)} value={formatNumber(stats[stat.field])} />)}
		<KeyValue label={i18n.t("app:profile.fields.breath")} value={i18n.t("app:profile.formats.progress", {value: stats.baseBreath, max: stats.maxBreath})} />
	</Panel>;
}