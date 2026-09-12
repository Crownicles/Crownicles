import {ReactNode, useState} from "react";
import {StyleSheet, Text, View} from "react-native";
import {FightFighter, FightEffect, FightEnd, FightReward} from "ws-packets/src/objects/Fight";
import {FightLogRecord} from "@/src/store/FightStore";
import {KeyValue, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {fighterName, fightActionName} from "@/src/display/Fight";
import {petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	participant: {flex: 1, minWidth: 0},
	meters: {padding: Theme.spacing.md, gap: Theme.spacing.md},
	label: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.caption, color: Theme.colors.muted},
	value: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.body, color: Theme.colors.ink},
	track: {height: Theme.dimensions.vitalBarHeight, backgroundColor: Theme.colors.line, marginTop: Theme.spacing.xs},
	fill: {height: "100%"}
});

function FightMeter({label, value, max, color}: {label: string; value: number; max?: number; color: string}): ReactNode {
	const ratio = max ? Math.max(0, Math.min(1, value / max)) : 1;
	return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{now: value, ...(max === undefined ? {} : {max})}}>
		<Text style={styles.label}>{label}</Text>
		<Text style={styles.value}>{max ? i18n.t("app:profile.formats.progress", {value, max}) : formatNumber(value)}</Text>
		<View style={styles.track}><View style={[styles.fill, {backgroundColor: color, width: `${ratio * 100}%`}]} /></View>
	</View>;
}

export function FighterDetails({fighter}: {fighter: FightFighter}): ReactNode {
	const stats = fighter.stats;
	const [expanded, setExpanded] = useState(false);
	return <View style={styles.participant}>
		<SectionHeader>{fighterName(fighter)}</SectionHeader>
		<Panel>
			<View style={styles.meters}>
				<FightMeter label={i18n.t("app:arena.energy")} value={stats.power} max={stats.maxEnergy} color={Theme.colors.green} />
				<FightMeter label={i18n.t("app:arena.breath")} value={stats.breath} max={stats.maxBreath} color={Theme.colors.gold} />
			</View>
			<Row title={i18n.t("app:arena.details")} onPress={(): void => setExpanded(!expanded)} chevron />
			{expanded ? (["attack", "defense", "speed", "breathRegen"] as const).map(stat => <KeyValue key={stat} label={i18n.t(`app:arena.stats.${stat}`)} value={formatNumber(stats[stat])} />) : null}
		</Panel>
	</View>;
}

function EffectDetails({effect, label}: {effect?: FightEffect; label: string}): ReactNode {
	if (!effect) return null;
	return <>
		{Object.entries(effect).filter(([, value]) => value !== undefined && value !== 0).map(([stat, value]) => <KeyValue key={stat} label={i18n.t("app:arena.effectLabel", {target: label, stat: i18n.t(`app:arena.effects.${stat}`)})} value={typeof value === "number" ? formatNumber(value) : i18n.t(`models:fight_actions.${value}.name`, {defaultValue: String(value)})} />)}
	</>;
}

export function FightLog({entries}: {entries: FightLogRecord[]}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:arena.log")}</SectionHeader>
		{entries.map(({entry, sequence}) => <Panel key={sequence}>
			<Row title={i18n.t("app:arena.logAction", {fighter: fighterName(entry.fighter), action: fightActionName(entry.usedFightActionId ?? entry.fightActionId)})} subtitle={entry.status ? i18n.t(`app:arena.status.${entry.status}`, {defaultValue: i18n.t("app:arena.status.other")}) : undefined} />
			{entry.pet ? <Note>{petName(entry.pet)}</Note> : null}
			<EffectDetails effect={entry.fightActionEffectDealt} label={i18n.t("app:arena.target")} />
			<EffectDetails effect={entry.fightActionEffectReceived} label={i18n.t("app:arena.actor")} />
		</Panel>)}
	</>;
}

function FightRewards({reward}: {reward: FightReward}): ReactNode {
	const ranking = reward.player1.isSelf ? reward.player1 : reward.player2;
	return <>
		<Panel>
			<KeyValue label={i18n.t("app:profile.fields.money")} value={formatMoney(reward.money)} />
			<KeyValue label={i18n.t("app:profile.fields.score")} value={formatNumber(reward.points)} />
			<KeyValue label={i18n.t("app:arena.glory")} value={i18n.t("app:arena.gloryChange", {before: ranking.oldGlory, after: ranking.newGlory})} />
			<KeyValue label={i18n.t("app:arena.league")} value={i18n.t(`models:leagues.${ranking.newLeagueId}`)} />
		</Panel>
		{reward.petLoveChange ? <Note>{i18n.t("app:arena.petLove", {count: reward.petLoveChange.loveChange})}</Note> : null}
	</>;
}

export function FightResult({result, reward}: {result: FightEnd; reward: FightReward | null}): ReactNode {
	return <>
		<SectionHeader>{i18n.t(result.draw ? "app:arena.draw" : result.winner.isSelf ? "app:arena.victory" : "app:arena.defeat")}</SectionHeader>
		<Panel>
			<KeyValue label={i18n.t("app:arena.turns")} value={formatNumber(result.turns)} />
			{[result.winner, result.loser].map(fighter => <KeyValue key={fighter.isSelf ? "self" : "opponent"} label={fighterName(fighter)} value={i18n.t("app:profile.formats.progress", {value: fighter.finalEnergy, max: fighter.maxEnergy})} />)}
		</Panel>
		{reward ? <FightRewards reward={reward} /> : null}
	</>;
}
