import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ChevronDown, Coins, Flag, Medal, Trophy, Swords} from "lucide-react-native";
import {FightEffect, FightEnd, FightReward} from "ws-packets/src/objects/Fight";
import {FightLogRecord} from "@/src/store/FightStore";
import {KeyValue, Note, Panel} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {formatNumber} from "@/src/display/Amounts";
import {fighterName, fightActionName} from "@/src/display/Fight";
import {petName} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";
import {fightCue} from "@/src/display/FightMotion";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const styles = StyleSheet.create({
	entry: {borderBottomWidth: 1, borderBottomColor: Theme.colors.line, paddingVertical: Theme.spacing.md},
	entryHead: {flexDirection: "row", alignItems: "center", gap: 10},
	entryBody: {flex: 1, minWidth: 0},
	action: {fontFamily: Theme.fonts.semiBold, fontSize: 12, lineHeight: 17, color: Theme.colors.ink},
	actor: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	turn: {fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.faint},
	status: {fontFamily: Theme.fonts.bold, fontSize: 10},
	result: {alignItems: "center", paddingTop: 20, paddingBottom: 24, gap: 10},
	emblem: {width: 80, height: 80, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash, borderRadius: 22, marginBottom: 4},
	resultTitle: {fontFamily: Theme.fonts.extraBold, fontSize: 30, lineHeight: 36, color: Theme.colors.ink, textAlign: "center"},
	resultSubtitle: {fontFamily: Theme.fonts.regular, fontSize: 13, lineHeight: 20, color: Theme.colors.muted, textAlign: "center"},
	rewards: {flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.line, paddingVertical: 20, marginBottom: 18},
	reward: {flex: 1, minWidth: 0, alignItems: "center", gap: 7, paddingHorizontal: 4},
	rewardValue: {fontFamily: Theme.fonts.extraBold, fontSize: 22, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	rewardLabel: {fontFamily: Theme.fonts.medium, fontSize: 11, color: Theme.colors.muted},
	resultDetails: {gap: 10},
	compact: {paddingVertical: 8},
	impact: {fontFamily: Theme.fonts.bold, fontSize: 12, color: Theme.colors.red}
});

function EffectDetails({effect, label}: {effect?: FightEffect; label: string}): ReactNode {
	if (!effect) return null;
	return <>
		{Object.entries(effect).filter(([, value]) => value !== undefined && value !== 0).map(([stat, value]) => <KeyValue key={stat} label={i18n.t("app:arena.effectLabel", {target: label, stat: i18n.t(`app:arena.effects.${stat}`)})} value={typeof value === "number" ? formatNumber(value) : i18n.t(`models:fight_actions.${value}.name`, {defaultValue: String(value)})} />)}
	</>;
}

function FightLogLine({record, compact}: {record: FightLogRecord; compact: boolean}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const {entry} = record;
	const cue = fightCue(entry);
	const icon = AppIcons.getIconOrNull(`fightActions.${cue.actionId}`);
	const impact = cue.impacts.find(effect => effect.kind === "damage");
	return <View style={[styles.entry, compact && styles.compact]}>
		<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={(): void => setExpanded(!expanded)} style={styles.entryHead}>
			{icon ? <TwemojiIcon emoji={icon} size={23} /> : <Swords size={20} color={cue.color} />}
			<View style={styles.entryBody}><Text style={styles.action}>{fightActionName(cue.actionId)}</Text><Text style={styles.actor}>{entry.pet ? petName(entry.pet) : fighterName(entry.fighter)}{record.before ? ` · ${i18n.t("app:battle.shortTurn", {turn: record.before.numberOfTurn})}` : ""}</Text></View>
			{impact ? <Text style={styles.impact}>-{formatNumber(impact.amount)}</Text> : null}
			{cue.missed || cue.critical ? <Text style={[styles.status, {color: cue.color}]}>{i18n.t(cue.critical ? "app:battle.critical" : "app:battle.missed")}</Text> : null}
			{!compact ? <ChevronDown size={14} color={Theme.colors.muted} /> : null}
		</Pressable>
		{expanded ? <>
			{entry.status ? <Note>{i18n.t(`app:arena.status.${entry.status}`, {defaultValue: i18n.t("app:arena.status.other")})}</Note> : null}
			<EffectDetails effect={entry.fightActionEffectDealt} label={i18n.t(cue.periodic ? "app:arena.actor" : "app:arena.target")} />
			<EffectDetails effect={entry.fightActionEffectReceived} label={i18n.t("app:arena.actor")} />
		</> : null}
	</View>;
}

export function FightLog({entries, compact = false}: {entries: FightLogRecord[]; compact?: boolean}): ReactNode {
	const visible = compact ? entries.slice(-2) : [...entries].reverse();
	if (!visible.length) return <Note>{i18n.t("app:battle.opening")}</Note>;
	return visible.map(record => <FightLogLine key={record.sequence} record={record} compact={compact} />);
}

function FightRewards({reward}: {reward: FightReward}): ReactNode {
	const ranking = reward.player1.isSelf ? reward.player1 : reward.player2;
	const gloryChange = ranking.newGlory - ranking.oldGlory;
	return <>
		<View style={styles.rewards}>
			<View style={styles.reward}><Medal size={23} color={Theme.colors.gold} /><Text style={[styles.rewardValue, {color: gloryChange < 0 ? Theme.colors.red : Theme.colors.green}]}>{gloryChange > 0 ? "+" : ""}{formatNumber(gloryChange)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:arena.glory")}</Text></View>
			<View style={styles.reward}><Coins size={23} color={Theme.colors.gold} /><Text style={styles.rewardValue}>{formatNumber(reward.money)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:profile.fields.money")}</Text></View>
			<View style={styles.reward}><Flag size={23} color={Theme.colors.blue} /><Text style={styles.rewardValue}>{formatNumber(reward.points)}</Text><Text style={styles.rewardLabel}>{i18n.t("app:profile.fields.score")}</Text></View>
		</View>
		<View style={styles.resultDetails}>
			<KeyValue label={i18n.t("app:arena.glory")} value={i18n.t("app:arena.gloryChange", {before: ranking.oldGlory, after: ranking.newGlory})} />
			<KeyValue label={i18n.t("app:arena.league")} value={i18n.t(`models:leagues.${ranking.newLeagueId}`)} />
		</View>
		{reward.petLoveChange ? <Note>{i18n.t("app:arena.petLove", {count: reward.petLoveChange.loveChange})}</Note> : null}
	</>;
}

export function FightResult({result, reward}: {result: FightEnd; reward: FightReward | null}): ReactNode {
	const opponent = result.winner.isSelf ? result.loser : result.winner;
	const won = !result.draw && result.winner.isSelf;
	const Icon = won ? Trophy : Swords;
	return <>
		<View style={styles.result}><View style={styles.emblem}><Icon size={43} color={won ? Theme.colors.gold : Theme.colors.muted} strokeWidth={1.6} /></View><Text style={styles.resultTitle}>{i18n.t(result.draw ? "app:arena.draw" : won ? "app:arena.victory" : "app:arena.defeat")}</Text><Text style={styles.resultSubtitle}>{i18n.t("app:battle.finishedAgainst", {opponent: fighterName(opponent), turns: result.turns})}</Text></View>
		{reward ? <FightRewards reward={reward} /> : null}
		<Panel>
			<KeyValue label={i18n.t("app:arena.turns")} value={formatNumber(result.turns)} />
			{[result.winner, result.loser].map(fighter => <KeyValue key={fighter.isSelf ? "self" : "opponent"} label={fighterName(fighter)} value={i18n.t("app:profile.formats.progress", {value: fighter.finalEnergy, max: fighter.maxEnergy})} />)}
		</Panel>
	</>;
}
