import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ChevronDown, Swords} from "@/src/design/FightIcons";
import {FightEffect, FightLogEntry} from "ws-packets/src/objects/Fight";
import {FightLogRecord} from "@/src/store/FightStore";
import {KeyValue, Note} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {formatNumber} from "@/src/display/Amounts";
import {fighterName, fightEntryTitle, fightImpactLabel, fightNarrative, fightConsequences} from "@/src/display/Fight";
import {petName, petIcon} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";
import {FightCue, fightCue} from "@/src/display/FightMotion";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {FightNarrative} from "@/src/components/FightNarrative";

const styles = StyleSheet.create({
	entry: {borderBottomWidth: 1, borderBottomColor: Theme.colors.line, paddingVertical: Theme.spacing.md},
	entryHead: {flexDirection: "row", alignItems: "center", gap: 10},
	entryBody: {flex: 1, minWidth: 0},
	action: {fontFamily: Theme.fonts.semiBold, fontSize: 12, lineHeight: 17, color: Theme.colors.ink},
	actor: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	status: {fontFamily: Theme.fonts.bold, fontSize: 10},
	compact: {paddingVertical: 8},
	impact: {fontFamily: Theme.fonts.bold, fontSize: 12, color: Theme.colors.red},
	story: {fontFamily: Theme.fonts.regular, fontSize: 12, lineHeight: 18, color: Theme.colors.ink, marginTop: 6},
	consequence: {fontFamily: Theme.fonts.medium, fontSize: 10, lineHeight: 15, color: Theme.colors.muted, marginTop: 3},
	pending: {color: Theme.colors.muted}
});

function EffectDetails({effect, label}: {effect?: FightEffect; label: string}): ReactNode {
	if (!effect) return null;
	return <>
		{Object.entries(effect).filter(([, value]) => value !== undefined && value !== 0).map(([stat, value]) => <KeyValue key={stat} label={i18n.t("app:arena.effectLabel", {target: label, stat: i18n.t(`app:arena.effects.${stat}`)})} value={typeof value === "number" ? formatNumber(value) : i18n.t(`models:fight_actions.${value}.name`, {defaultValue: String(value)})} />)}
	</>;
}

function FightLogImpact({cue}: {cue: FightCue}): ReactNode {
	const impact = cue.impacts.find(effect => effect.kind === "damage");
	return <>
		{impact ? <Text style={[styles.impact, impact.amount < 0 && {color: Theme.colors.green}]}>{fightImpactLabel(impact)}</Text> : null}
		{cue.missed || cue.critical ? <Text style={[styles.status, {color: cue.color}]}>{i18n.t(cue.critical ? "app:battle.critical" : "app:battle.missed")}</Text> : null}
	</>;
}

export function FightEventIcon({entry, size = 23}: {entry: FightLogEntry; size?: number}): ReactNode {
	const icon = entry.pet ? petIcon(entry.pet) : AppIcons.getIconOrNull(`fightActions.${entry.usedFightActionId ?? entry.fightActionId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Swords size={size} color={fightCue(entry).color} />;
}

export function FightEventStory({record, pending = false}: {record: FightLogRecord; pending?: boolean}): ReactNode {
	return <>
		<FightNarrative style={[styles.story, pending && styles.pending]}>{fightNarrative(record.entry, pending)}</FightNarrative>
		{!pending ? fightConsequences(record.entry, record.after ?? record.before).map(text => <Text key={text} style={styles.consequence}>{text}</Text>) : null}
	</>;
}

function FightLogSummary({record, compact, cue, pending}: {record: FightLogRecord; compact: boolean; cue: FightCue; pending: boolean}): ReactNode {
	const actor = record.entry.pet ? petName(record.entry.pet) : fighterName(record.entry.fighter);
	const turn = record.before ? i18n.t("app:battle.shortTurn", {turn: record.before.numberOfTurn}) : "";
	return <>
		<FightEventIcon entry={record.entry} />
		<View style={styles.entryBody}><Text style={styles.action}>{fightEntryTitle(record.entry)}</Text><Text style={styles.actor}>{[actor, turn].filter(Boolean).join(" · ")}</Text></View>
		{!pending ? <FightLogImpact cue={cue} /> : null}
		{!compact ? <ChevronDown size={14} color={Theme.colors.muted} /> : null}
	</>;
}

function FightLogEffects({entry, cue}: {entry: FightLogEntry; cue: FightCue}): ReactNode {
	return <>
		{entry.status ? <Note>{i18n.t(`app:arena.status.${entry.status}`, {defaultValue: i18n.t("app:arena.status.other")})}</Note> : null}
		<EffectDetails effect={entry.fightActionEffectDealt} label={i18n.t(cue.periodic ? "app:arena.actor" : "app:arena.target")} />
		<EffectDetails effect={entry.fightActionEffectReceived} label={i18n.t("app:arena.actor")} />
	</>;
}

function FightLogLine({record, compact, pending}: {record: FightLogRecord; compact: boolean; pending: boolean}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const cue = fightCue(record.entry);
	return <View style={[styles.entry, compact && styles.compact]}>
		<Pressable accessibilityRole="button" accessibilityState={{expanded, disabled: pending}} disabled={pending} onPress={(): void => setExpanded(!expanded)} style={styles.entryHead}>
			<FightLogSummary record={record} compact={compact} cue={cue} pending={pending} />
		</Pressable>
		<FightEventStory record={record} pending={pending} />
		{expanded && !pending ? <FightLogEffects entry={record.entry} cue={cue} /> : null}
	</View>;
}

export function FightLog({entries, compact = false, pendingSequence}: {entries: FightLogRecord[]; compact?: boolean; pendingSequence?: number}): ReactNode {
	const visible = compact ? entries.slice(-2) : [...entries].reverse();
	if (!visible.length) return <Note>{i18n.t("app:battle.opening")}</Note>;
	return visible.map(record => <FightLogLine key={record.sequence} record={record} compact={compact} pending={record.sequence === pendingSequence} />);
}
