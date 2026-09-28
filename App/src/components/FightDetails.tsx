import {ReactNode} from "react";
import {Text, View} from "react-native";
import {Swords} from "@/src/design/FightIcons";
import {FightLogEntry} from "ws-packets/src/objects/Fight";
import {FightLogRecord} from "@/src/store/FightStore";
import {Note} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {fighterName, fightEntryTitle, fightImpactLabel, fightNarrative, fightConsequences} from "@/src/display/Fight";
import {petName, petIcon} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";
import {joinFacts} from "@/src/display/Facts";
import {FightCue, fightCue} from "@/src/display/FightMotion";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {FightEffectChips, FightNarrative} from "@/src/components/FightNarrative";
import {createStyles, paletteColor, useColors} from "@/src/design/ThemeContext";

const useStyles = createStyles(colors => ({
	entry: {borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: Theme.spacing.md},
	current: {borderLeftWidth: 3, borderLeftColor: colors.blue, paddingLeft: 10},
	entryHead: {flexDirection: "row", alignItems: "center", gap: 10},
	entryBody: {flex: 1, minWidth: 0},
	action: {fontFamily: Theme.fonts.bold, fontSize: 12, lineHeight: 17, color: colors.ink},
	actor: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: colors.muted},
	status: {fontFamily: Theme.fonts.bold, fontSize: 10},
	compact: {paddingVertical: 8},
	impact: {fontFamily: Theme.fonts.bold, fontSize: 12, color: colors.red},
	story: {fontFamily: Theme.fonts.regular, fontSize: 13, lineHeight: 20, color: colors.ink, marginTop: 6}
}));

function FightLogImpact({cue}: {cue: FightCue}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const impact = cue.impacts.find(effect => effect.kind === "damage");
	return <>
		{impact ? <Text style={[styles.impact, impact.amount < 0 && {color: colors.green}]}>{fightImpactLabel(impact)}</Text> : null}
		{cue.missed || cue.critical ? <Text style={[styles.status, {color: paletteColor(colors, cue.color)}]}>{i18n.t(cue.critical ? "app:battle.critical" : "app:battle.missed")}</Text> : null}
	</>;
}

export function FightEventIcon({entry, size = 23}: {entry: FightLogEntry; size?: number}): ReactNode {
	const colors = useColors();
	const icon = entry.pet ? petIcon(entry.pet) : AppIcons.getIconOrNull(`fightActions.${entry.usedFightActionId ?? entry.fightActionId}`);
	return icon ? <TwemojiIcon emoji={icon} size={size} /> : <Swords size={size} color={paletteColor(colors, fightCue(entry).color)} />;
}

export function FightEventStory({record}: {record: FightLogRecord}): ReactNode {
	const styles = useStyles();
	return <>
		<FightNarrative style={styles.story}>{fightNarrative(record.entry, record.sequence)}</FightNarrative>
		<FightEffectChips effects={fightConsequences(record.entry)} />
	</>;
}

function FightLogSummary({record, cue}: {record: FightLogRecord; cue: FightCue}): ReactNode {
	const styles = useStyles();
	const actor = record.entry.pet ? petName(record.entry.pet) : fighterName(record.entry.fighter);
	const turn = record.before ? i18n.t("app:battle.shortTurn", {turn: record.before.numberOfTurn}) : "";
	return <>
		<FightEventIcon entry={record.entry} />
		<View style={styles.entryBody}><Text style={styles.action}>{fightEntryTitle(record.entry)}</Text><Text style={styles.actor}>{joinFacts([actor, turn])}</Text></View>
		<FightLogImpact cue={cue} />
	</>;
}

type FightLogLineProps = {record: FightLogRecord; compact: boolean; current: boolean};

function FightLogLine({record, compact, current}: FightLogLineProps): ReactNode {
	const styles = useStyles();
	return <View style={[styles.entry, compact && styles.compact, current && styles.current]}>
		<View style={styles.entryHead}><FightLogSummary record={record} cue={fightCue(record.entry)} /></View>
		<FightEventStory record={record} />
	</View>;
}

type FightLogProps = {entries: FightLogRecord[]; compact?: boolean};

export function FightLog({entries, compact = false}: FightLogProps): ReactNode {
	if (!entries.length) return <Note>{i18n.t("app:battle.opening")}</Note>;
	const latestSequence = entries.at(-1)!.sequence;
	return entries.map(record => <FightLogLine key={record.sequence} record={record} compact={compact} current={record.sequence === latestSequence} />);
}

/** The live feed shows only the action being played; the full history stays in the journal. */
export function FightLatestEvent({record}: {record: FightLogRecord}): ReactNode {
	const styles = useStyles();
	return <View>
		<View style={styles.entryHead}><FightLogSummary record={record} cue={fightCue(record.entry)} /></View>
		<FightEventStory record={record} />
	</View>;
}
