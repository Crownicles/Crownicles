import {ReactNode, useRef, useState} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {CircleAlert} from "@/src/design/FightIcons";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Button, ButtonRow, Confirmation, Note} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {FightActions, FightActionsWaiting} from "@/src/collectors/FightActionCollector";
import {FightSnapshot, FightLogRecord} from "@/src/store/FightStore";
import {FightLog} from "@/src/components/FightDetails";
import {FightResult} from "@/src/components/FightResult";
import {FightStage} from "@/src/components/FightStage";
import {FIGHT_PHASES, FightActivity, FightHeader, FightNavigation, FightPhase, FightReadingControls, useCompactFight} from "@/src/components/FightControls";
import {FightPlayback, useFightPlayback} from "@/src/store/useFightPlayback";
import {i18n} from "@/src/translations/i18n";
import {useFightSpeed} from "@/src/store/useFightSpeed";
import {FightSpeed} from "@/src/display/FightMotion";

const styles = StyleSheet.create({
	content: {width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: Theme.spacing.xl, paddingBottom: 24},
	activitySubtitle: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	journal: {maxHeight: 480},
	resultActions: {marginTop: 18},
	loading: {minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14},
	compactContent: {paddingHorizontal: 12, paddingBottom: 12}
});

type FightLiveProps = {fight: FightSnapshot; collector?: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean; onClose: () => void};
type FightContentProps = FightLiveProps & {playback: FightPlayback; navigation: FightNavigation; speed: FightSpeed; readingControls: FightReadingControls};

function fightPhase(props: FightLiveProps, playback: FightPlayback): FightPhase {
	if (props.fight.error) return FIGHT_PHASES.ERROR;
	if (playback.reading) return FIGHT_PHASES.READING;
	if (playback.record || props.submitting) return FIGHT_PHASES.PLAYING;
	if (props.fight.result) return FIGHT_PHASES.FINISHED;
	return props.collector ? FIGHT_PHASES.SELF : FIGHT_PHASES.OPPONENT;
}

function FightTurn({fight, playback, collector, onChoose, submitting, navigation, speed, readingControls}: FightContentProps): ReactNode {
	const status = playback.status;
	if (!status) return <View style={styles.loading}><ActivityIndicator color={Theme.colors.muted} /><Text style={styles.activitySubtitle}>{i18n.t("app:battle.preparing")}</Text></View>;
	const pending = submitting || Boolean(playback.record);
	return <>
		<FightStage status={status} introduction={fight.introduction} record={playback.record} onImpact={playback.impact} onComplete={playback.finishMotion} reducedMotion={playback.reducedMotion} speed={speed} />
		<FightActivity entries={playback.logs} {...playback.record && !playback.impacted ? {pendingSequence: playback.record.sequence} : {}} ownTurn={Boolean(collector) && !pending} onJournal={navigation.onJournal} readingControls={readingControls} />
		{collector ? <FightActions key={collector.id} collector={collector} onChoose={onChoose} submitting={pending} /> : <FightActionsWaiting actions={fight.introduction?.initiatorActions ?? []} />}
	</>;
}

function FightContent(props: FightContentProps): ReactNode {
	const {fight, playback, navigation} = props;
	if (fight.error) return <View style={styles.loading}><CircleAlert size={38} color={Theme.colors.muted} /><Note>{i18n.t(`app:arena.errors.${fight.error}`)}</Note><Button onPress={navigation.onClose}>{i18n.t("app:battle.returnToArena")}</Button></View>;
	if (!fight.result || playback.record) return <FightTurn {...props} />;
	return <><FightResult result={fight.result} reward={fight.reward} /><View style={styles.resultActions}><ButtonRow><Button variant="primary" onPress={navigation.onClose}>{i18n.t("app:battle.returnToArena")}</Button><Button onPress={navigation.onJournal}>{i18n.t("app:arena.log")}</Button></ButtonRow></View></>;
}

function FightJournal({entries, onClose, pendingSequence}: {entries: FightLogRecord[]; onClose: () => void; pendingSequence?: number}): ReactNode {
	const {height} = useWindowDimensions();
	const scroll = useRef<ScrollView>(null);
	const positioned = useRef(false);
	const showLatest = (): void => {
		if (positioned.current) return;
		positioned.current = true;
		scroll.current?.scrollToEnd({animated: false});
	};
	return <Confirmation title={i18n.t("app:arena.log")} onRequestClose={onClose}><ScrollView ref={scroll} style={[styles.journal, {maxHeight: height * 0.6}]} onContentSizeChange={showLatest}><FightLog entries={entries} {...pendingSequence === undefined ? {} : {pendingSequence}} /></ScrollView><ButtonRow><Button onPress={onClose}>{i18n.t("app:battle.backToFight")}</Button></ButtonRow></Confirmation>;
}

export function FightLiveView(props: FightLiveProps): ReactNode {
	const compact = useCompactFight();
	const speedSetting = useFightSpeed();
	const [journal, setJournal] = useState(false);
	const [paused, setPaused] = useState(false);
	const playback = useFightPlayback(props.fight, {speed: speedSetting.speed, paused: journal || paused});
	const readingControls = {paused, pause: (): void => setPaused(true), toggle: (): void => setPaused(previous => !previous)};
	const navigation = {onClose: props.onClose, onJournal: (): void => setJournal(true)};
	return <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
		<FightHeader fight={props.fight} playback={playback} phase={fightPhase(props, playback)} navigation={navigation} />
		<FightContent {...props} playback={playback} navigation={navigation} speed={speedSetting.speed} readingControls={readingControls} />
		{journal ? <FightJournal entries={playback.logs} {...playback.record && !playback.impacted ? {pendingSequence: playback.record.sequence} : {}} onClose={(): void => setJournal(false)} /> : null}
	</ScrollView>;
}