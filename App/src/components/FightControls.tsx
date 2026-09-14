import {ReactNode, useRef, useState} from "react";
import {LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {ChevronDown, History, LucideIcon, Pause, Play, X} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import type {FightLogRecord, FightSnapshot} from "@/src/store/FightStore";
import type {FightPlayback} from "@/src/store/useFightPlayback";
import {FightLog} from "@/src/components/FightDetails";
import {i18n} from "@/src/translations/i18n";

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
	activity: {marginVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.line},
	activityHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44},
	feed: {height: 156},
	compactFeed: {height: 120},
	activityTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, lineHeight: 17, color: Theme.colors.ink},
	activitySubtitle: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	compactHeader: {paddingTop: 0, paddingBottom: 6}
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

export const FIGHT_PHASES = {FINISHED: "finished", ERROR: "unavailable", PLAYING: "resolving", READING: "reading", SELF: "yourTurn", OPPONENT: "opponentTurn"} as const;
export type FightPhase = typeof FIGHT_PHASES[keyof typeof FIGHT_PHASES];
export type FightNavigation = {onClose: () => void; onJournal: () => void};
export type FightReadingControls = {paused: boolean; pause: () => void; toggle: () => void};

export function FightHeader({fight, playback, phase, navigation}: {fight: FightSnapshot; playback: FightPlayback; phase: FightPhase; navigation: FightNavigation}): ReactNode {
	const compact = useCompactFight();
	const status = playback.status;
	const finished = phase === FIGHT_PHASES.FINISHED || phase === FIGHT_PHASES.ERROR;
	return <View style={[styles.header, compact && styles.compactHeader]}>
		<View style={styles.headerBody}><Text style={styles.eyebrow}>{i18n.t(fight.introduction?.opponent.monsterId ? "app:battle.encounter" : "app:battle.duel")}</Text><Text style={styles.title}>{i18n.t(`app:battle.${phase}`)}</Text></View>
		<View><Text style={styles.turn}>{status ? i18n.t("app:arena.turn", {turn: status.numberOfTurn, max: status.maxNumberOfTurn}) : ""}</Text><View style={styles.headerActions}><FightIconButton icon={finished ? X : ChevronDown} label={i18n.t(finished ? "app:common.back" : "app:arena.minimize")} onPress={navigation.onClose} /></View></View>
	</View>;
}

export function FightActivity({entries, pendingSequence, ownTurn, onJournal, readingControls}: {entries: FightLogRecord[]; pendingSequence?: number; ownTurn: boolean; onJournal: () => void; readingControls: FightReadingControls}): ReactNode {
	const compact = useCompactFight();
	const feed = useRef<ScrollView>(null);
	const latestOffset = useRef(0);
	const followLatest = (event: LayoutChangeEvent): void => {
		latestOffset.current = event.nativeEvent.layout.y;
		if (!readingControls.paused) feed.current?.scrollTo({y: latestOffset.current, animated: false});
	};
	const toggleReading = (): void => {
		if (readingControls.paused) feed.current?.scrollTo({y: latestOffset.current, animated: false});
		readingControls.toggle();
	};
	return <View style={styles.activity}>
		<View style={styles.activityHead}>
			<Text style={styles.activityTitle}>{i18n.t(readingControls.paused ? "app:battle.story.paused" : "app:battle.story.live")}</Text>
			<View style={styles.headerActions}><FightIconButton icon={readingControls.paused ? Play : Pause} label={i18n.t(readingControls.paused ? "app:battle.story.resume" : "app:battle.story.pause")} onPress={toggleReading} /><FightIconButton icon={History} label={i18n.t("app:battle.showHistory")} onPress={onJournal} /></View>
		</View>
		<ScrollView ref={feed} style={[styles.feed, compact && styles.compactFeed]} nestedScrollEnabled onScrollBeginDrag={readingControls.pause} accessibilityLiveRegion="polite">
			{entries.length ? <FightLog entries={entries} compact {...pendingSequence === undefined ? {} : {pendingSequence}} onLatestLayout={followLatest} /> : <Text style={styles.activitySubtitle}>{i18n.t(ownTurn ? "app:battle.ready" : "app:arena.waiting")}</Text>}
		</ScrollView>
	</View>;
}