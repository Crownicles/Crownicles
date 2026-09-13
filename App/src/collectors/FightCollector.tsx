import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View} from "react-native";
import {ChevronDown, History, Swords, X} from "lucide-react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useQueryClient} from "@tanstack/react-query";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Confirmation, Note} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {FightActions, FightActionsWaiting} from "@/src/collectors/FightActionCollector";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {fightStore, useFight, FightSnapshot} from "@/src/store/FightStore";
import {FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {FightLog, FightResult} from "@/src/components/FightDetails";
import {FightStage, FightBreath} from "@/src/components/FightStage";
import {FightIconButton, useCompactFight} from "@/src/components/FightControls";
import {useFightPlayback} from "@/src/store/useFightPlayback";
import {fightActionName, fightFeedback} from "@/src/display/Fight";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	root: {flex: 1, backgroundColor: Theme.colors.paper},
	content: {width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: Theme.spacing.xl, paddingBottom: 24},
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
	journal: {maxHeight: 480},
	resultActions: {marginTop: 18},
	loading: {minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14},
	compactContent: {paddingHorizontal: 12, paddingBottom: 12},
	compactHeader: {paddingTop: 0, paddingBottom: 6},
	compactActivity: {minHeight: 44, marginVertical: 8, paddingVertical: 0, paddingHorizontal: 9}
});

type FightLiveProps = {fight: FightSnapshot; collector?: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean; onClose: () => void};

export function FightLiveView({fight, collector, onChoose, submitting, onClose}: FightLiveProps): ReactNode {
	const compact = useCompactFight();
	const playback = useFightPlayback(fight);
	const [journal, setJournal] = useState(false);
	const playing = Boolean(playback.record);
	const finished = Boolean(fight.result) && !playing;
	const ownTurn = Boolean(collector) && !playing && !submitting;
	const status = playback.status;
	const self = status?.activeFighter.isSelf ? status.activeFighter : status?.defendingFighter;
	const latest = playback.record ?? playback.logs.at(-1);
	const title = finished ? "app:battle.finished" : playing ? "app:battle.resolving" : ownTurn ? "app:battle.yourTurn" : "app:battle.opponentTurn";
	return <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
		<View style={[styles.header, compact && styles.compactHeader]}>
			<View style={styles.headerBody}><Text style={styles.eyebrow}>{i18n.t(fight.introduction?.opponent.monsterId ? "app:battle.encounter" : "app:battle.duel")}</Text><Text style={styles.title}>{i18n.t(title)}</Text></View>
			<View><Text style={styles.turn}>{status ? i18n.t("app:arena.turn", {turn: status.numberOfTurn, max: status.maxNumberOfTurn}) : ""}</Text><View style={styles.headerActions}><FightIconButton icon={History} label={i18n.t("app:arena.log")} onPress={(): void => setJournal(true)} /><FightIconButton icon={finished ? X : ChevronDown} label={i18n.t(finished ? "app:common.back" : "app:arena.minimize")} onPress={onClose} /></View></View>
		</View>
		{fight.error ? <Note>{i18n.t(`app:arena.errors.${fight.error}`)}</Note> : null}
		{finished && fight.result ? <><FightResult result={fight.result} reward={fight.reward} /><View style={styles.resultActions}><ButtonRow><Button variant="primary" onPress={onClose}>{i18n.t("app:battle.returnToArena")}</Button><Button onPress={(): void => setJournal(true)}>{i18n.t("app:arena.log")}</Button></ButtonRow></View></> : <>
			{status ? <FightStage status={status} introduction={fight.introduction} record={playback.record} onImpact={playback.impact} onComplete={playback.complete} reducedMotion={playback.reducedMotion} /> : <View style={styles.loading}><ActivityIndicator color={Theme.colors.muted} /><Text style={styles.activitySubtitle}>{i18n.t("app:battle.preparing")}</Text></View>}
			{self ? <FightBreath fighter={self} reducedMotion={playback.reducedMotion} /> : null}
			<View style={[styles.activity, compact && styles.compactActivity]} accessibilityLiveRegion="polite">
				{!ownTurn && !latest ? <ActivityIndicator size="small" color={Theme.colors.blue} /> : <Swords size={19} color={Theme.colors.muted} />}
				<View style={styles.activityBody}><Text style={styles.activityTitle}>{latest ? fightActionName(latest.entry.usedFightActionId ?? latest.entry.fightActionId) : i18n.t("app:battle.opening")}</Text><Text style={styles.activitySubtitle}>{latest ? fightFeedback(latest.entry) : i18n.t(ownTurn ? "app:battle.ready" : "app:arena.waiting")}</Text></View>
				<FightIconButton icon={History} label={i18n.t("app:battle.showHistory")} onPress={(): void => setJournal(true)} />
			</View>
			{collector ? <FightActions key={collector.id} collector={collector} onChoose={onChoose} submitting={submitting || playing} /> : <FightActionsWaiting actions={fight.introduction?.initiatorActions ?? []} />}
		</>}
		{journal ? <Confirmation title={i18n.t("app:arena.log")} onRequestClose={(): void => setJournal(false)}><ScrollView style={styles.journal}><FightLog entries={playback.logs} /></ScrollView><ButtonRow><Button onPress={(): void => setJournal(false)}>{i18n.t("app:battle.backToFight")}</Button></ButtonRow></Confirmation> : null}
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
