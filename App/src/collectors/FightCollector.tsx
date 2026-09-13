import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {CircleAlert} from "@/src/design/FightIcons";
import {SafeAreaView} from "react-native-safe-area-context";
import {useQueryClient} from "@tanstack/react-query";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Confirmation, Note} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {FightActions, FightActionsWaiting} from "@/src/collectors/FightActionCollector";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {fightStore, useFight, FightSnapshot, FightLogRecord} from "@/src/store/FightStore";
import {FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {FightLog} from "@/src/components/FightDetails";
import {FightResult} from "@/src/components/FightResult";
import {FightStage} from "@/src/components/FightStage";
import {FightBreath} from "@/src/components/FightGauge";
import {FIGHT_PHASES, FightActivity, FightHeader, FightNavigation, FightPhase, useCompactFight} from "@/src/components/FightControls";
import {FightPlayback, useFightPlayback} from "@/src/store/useFightPlayback";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	root: {flex: 1, backgroundColor: Theme.colors.paper},
	content: {width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: Theme.spacing.xl, paddingBottom: 24},
	activitySubtitle: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	journal: {maxHeight: 480},
	resultActions: {marginTop: 18},
	loading: {minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14},
	compactContent: {paddingHorizontal: 12, paddingBottom: 12}
});

type FightLiveProps = {fight: FightSnapshot; collector?: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean; onClose: () => void};
type FightContentProps = FightLiveProps & {playback: FightPlayback; navigation: FightNavigation};

function fightPhase(props: FightLiveProps, playback: FightPlayback): FightPhase {
	if (props.fight.error) return FIGHT_PHASES.ERROR;
	if (playback.record || props.submitting) return FIGHT_PHASES.PLAYING;
	if (props.fight.result) return FIGHT_PHASES.FINISHED;
	return props.collector ? FIGHT_PHASES.SELF : FIGHT_PHASES.OPPONENT;
}

function FightTurn({fight, playback, collector, onChoose, submitting, navigation}: FightContentProps): ReactNode {
	const status = playback.status;
	if (!status) return <View style={styles.loading}><ActivityIndicator color={Theme.colors.muted} /><Text style={styles.activitySubtitle}>{i18n.t("app:battle.preparing")}</Text></View>;
	const self = status.activeFighter.isSelf ? status.activeFighter : status.defendingFighter;
	const pending = submitting || Boolean(playback.record);
	return <>
		<FightStage status={status} introduction={fight.introduction} record={playback.record} onImpact={playback.impact} onComplete={playback.complete} reducedMotion={playback.reducedMotion} />
		<FightBreath fighter={self} reducedMotion={playback.reducedMotion} />
		<FightActivity latest={playback.record ?? playback.logs.at(-1)} ownTurn={Boolean(collector) && !pending} onJournal={navigation.onJournal} />
		{collector ? <FightActions key={collector.id} collector={collector} onChoose={onChoose} submitting={pending} /> : <FightActionsWaiting actions={fight.introduction?.initiatorActions ?? []} />}
	</>;
}

function FightContent(props: FightContentProps): ReactNode {
	const {fight, playback, navigation} = props;
	if (fight.error) return <View style={styles.loading}><CircleAlert size={38} color={Theme.colors.muted} /><Note>{i18n.t(`app:arena.errors.${fight.error}`)}</Note><Button onPress={navigation.onClose}>{i18n.t("app:battle.returnToArena")}</Button></View>;
	if (!fight.result || playback.record) return <FightTurn {...props} />;
	return <><FightResult result={fight.result} reward={fight.reward} /><View style={styles.resultActions}><ButtonRow><Button variant="primary" onPress={navigation.onClose}>{i18n.t("app:battle.returnToArena")}</Button><Button onPress={navigation.onJournal}>{i18n.t("app:arena.log")}</Button></ButtonRow></View></>;
}

function FightJournal({entries, onClose}: {entries: FightLogRecord[]; onClose: () => void}): ReactNode {
	const {height} = useWindowDimensions();
	return <Confirmation title={i18n.t("app:arena.log")} onRequestClose={onClose}><ScrollView style={[styles.journal, {maxHeight: height * 0.6}]}><FightLog entries={entries} /></ScrollView><ButtonRow><Button onPress={onClose}>{i18n.t("app:battle.backToFight")}</Button></ButtonRow></Confirmation>;
}

export function FightLiveView(props: FightLiveProps): ReactNode {
	const compact = useCompactFight();
	const playback = useFightPlayback(props.fight);
	const [journal, setJournal] = useState(false);
	const navigation = {onClose: props.onClose, onJournal: (): void => setJournal(true)};
	return <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
		<FightHeader fight={props.fight} playback={playback} phase={fightPhase(props, playback)} navigation={navigation} />
		<FightContent {...props} playback={playback} navigation={navigation} />
		{journal ? <FightJournal entries={playback.logs} onClose={(): void => setJournal(false)} /> : null}
	</ScrollView>;
}

function useFightCompletion(fight: FightSnapshot): boolean {
	const queryClient = useQueryClient();
	const completed = fight.reward ?? (fight.introduction?.opponent.monsterId ? fight.result : null) ?? (fight.error === FIGHT_ERRORS.BUGGED ? fight.error : null);
	useEffect(() => {
		if (!completed) return;
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.PET, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT, GAME_ENTITIES.FIGHT_HISTORY, GAME_ENTITIES.LEAGUES, GAME_ENTITIES.RANKINGS]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}, [completed, queryClient]);
	return Boolean(completed);
}

export function FightSession(): ReactNode {
	const fight = useFight();
	const {open, react, isAnswerPending} = useCollectors();
	const completed = useFightCompletion(fight);
	const collector = open.find(entry => entry.data.type === FIGHT_DATA_KINDS.ACTION && entry.data.data.fightId === fight.introduction?.fightId);
	if (!fight.visible) return null;
	const close = completed || fight.error ? fightStore.reset : fightStore.minimize;
	return <Modal visible animationType="slide" onRequestClose={close}>
		<SafeAreaView style={styles.root}>
			<FightLiveView key={fight.introduction?.fightId} fight={fight} collector={collector} onChoose={(index): void => {if (collector) react(collector.id, index);}} submitting={collector ? isAnswerPending(collector.id) : false} onClose={close} />
		</SafeAreaView>
	</Modal>;
}
