import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {ChevronDown, History, LucideIcon, Swords, X} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import type {FightLogRecord, FightSnapshot} from "@/src/store/FightStore";
import type {FightPlayback} from "@/src/store/useFightPlayback";
import {fightActionName, fightFeedback} from "@/src/display/Fight";
import {i18n} from "@/src/translations/i18n";
import {FightSpeedSetting} from "@/src/store/useFightSpeed";
import {FIGHT_SPEEDS} from "@/src/display/FightMotion";

const styles = StyleSheet.create({
	root: {position: "relative"},
	button: {width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12},
	pressed: {backgroundColor: Theme.colors.wash},
	tooltip: {position: "absolute", right: 0, top: 44, minWidth: 112, maxWidth: 210, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, backgroundColor: Theme.colors.ink, zIndex: 20},
	label: {fontFamily: Theme.fonts.medium, fontSize: 11, lineHeight: 15, color: Theme.colors.paper},
	header: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 8, paddingBottom: 12},
	headerBody: {flex: 1, minWidth: 0},
	eyebrow: {fontFamily: Theme.fonts.semiBold, fontSize: 10, color: Theme.colors.muted, letterSpacing: 0, textTransform: "uppercase", marginBottom: 5},
	title: {fontFamily: Theme.fonts.extraBold, fontSize: 22, lineHeight: 28, color: Theme.colors.ink},
	headerActions: {flexDirection: "row", alignItems: "center"},
	turn: {fontFamily: Theme.fonts.semiBold, fontSize: 11, color: Theme.colors.muted, textAlign: "right", fontVariant: ["tabular-nums"]},
	activity: {flexDirection: "row", alignItems: "center", gap: 9, minHeight: 60, marginVertical: 12, padding: 12, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: 12, backgroundColor: Theme.colors.wash},
	activityBody: {flex: 1, minWidth: 0},
	activityTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, lineHeight: 17, color: Theme.colors.ink},
	activitySubtitle: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	compactHeader: {paddingTop: 0, paddingBottom: 6},
	compactActivity: {minHeight: 44, marginVertical: 8, paddingVertical: 0, paddingHorizontal: 9},
	speed: {fontFamily: Theme.fonts.bold, fontSize: 13, color: Theme.colors.muted},
	fastSpeed: {color: Theme.colors.blue},
	fastButton: {backgroundColor: Theme.colors.wash}
});

export function useCompactFight(): boolean {
	return useWindowDimensions().height < 740;
}

export function FightIconButton({icon: Icon, label, onPress, disabled = false}: {icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean}): ReactNode {
	const [hovered, setHovered] = useState(false);
	return <View style={styles.root}>
		<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={(): void => {setHovered(false); onPress();}} onHoverIn={(): void => setHovered(true)} onHoverOut={(): void => setHovered(false)} style={({pressed}) => [styles.button, pressed && styles.pressed]}><Icon size={19} color={disabled ? Theme.colors.faint : Theme.colors.muted} /></Pressable>
		{hovered ? <View pointerEvents="none" style={styles.tooltip}><Text style={styles.label}>{label}</Text></View> : null}
	</View>;
}

export const FIGHT_PHASES = {FINISHED: "finished", ERROR: "unavailable", PLAYING: "resolving", SELF: "yourTurn", OPPONENT: "opponentTurn"} as const;
export type FightPhase = typeof FIGHT_PHASES[keyof typeof FIGHT_PHASES];
export type FightNavigation = {onClose: () => void; onJournal: () => void};

function FightSpeedControl({speed, setSpeed}: FightSpeedSetting): ReactNode {
	const fast = speed === FIGHT_SPEEDS.FAST;
	return <Pressable accessibilityRole="switch" accessibilityLabel={i18n.t("app:battle.speed.fast")} accessibilityState={{checked: fast}} aria-checked={fast} onPress={(): void => setSpeed(fast ? FIGHT_SPEEDS.NORMAL : FIGHT_SPEEDS.FAST)} style={({pressed}) => [styles.button, fast && styles.fastButton, pressed && styles.pressed]}><Text style={[styles.speed, fast && styles.fastSpeed]}>{i18n.t(fast ? "app:battle.speed.fastValue" : "app:battle.speed.normalValue")}</Text></Pressable>;
}

export function FightHeader({fight, playback, phase, navigation, speedSetting}: {fight: FightSnapshot; playback: FightPlayback; phase: FightPhase; navigation: FightNavigation; speedSetting: FightSpeedSetting}): ReactNode {
	const compact = useCompactFight();
	const status = playback.status;
	const finished = phase === FIGHT_PHASES.FINISHED || phase === FIGHT_PHASES.ERROR;
	return <View style={[styles.header, compact && styles.compactHeader]}>
		<View style={styles.headerBody}><Text style={styles.eyebrow}>{i18n.t(fight.introduction?.opponent.monsterId ? "app:battle.encounter" : "app:battle.duel")}</Text><Text style={styles.title}>{i18n.t(`app:battle.${phase}`)}</Text></View>
		<View><Text style={styles.turn}>{status ? i18n.t("app:arena.turn", {turn: status.numberOfTurn, max: status.maxNumberOfTurn}) : ""}</Text><View style={styles.headerActions}><FightSpeedControl {...speedSetting} /><FightIconButton icon={History} label={i18n.t("app:arena.log")} onPress={navigation.onJournal} /><FightIconButton icon={finished ? X : ChevronDown} label={i18n.t(finished ? "app:common.back" : "app:arena.minimize")} onPress={navigation.onClose} /></View></View>
	</View>;
}

export function FightActivity({latest, ownTurn, onJournal}: {latest?: FightLogRecord; ownTurn: boolean; onJournal: () => void}): ReactNode {
	const compact = useCompactFight();
	const title = latest ? fightActionName(latest.entry.usedFightActionId ?? latest.entry.fightActionId) : i18n.t("app:battle.opening");
	const subtitle = latest ? fightFeedback(latest.entry) : i18n.t(ownTurn ? "app:battle.ready" : "app:arena.waiting");
	return <View style={[styles.activity, compact && styles.compactActivity]} accessibilityLiveRegion="polite">
		<Swords size={19} color={Theme.colors.muted} />
		<View style={styles.activityBody}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.activitySubtitle}>{subtitle}</Text></View>
		<FightIconButton icon={History} label={i18n.t("app:battle.showHistory")} onPress={onJournal} />
	</View>;
}