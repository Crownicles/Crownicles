import {ReactNode, useRef, useState} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions} from "react-native";
import {CircleAlert} from "@/src/design/FightIcons";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {Sheet} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {FightActions, FightActionsWaiting} from "@/src/collectors/FightActionCollector";
import {FightSnapshot, FightLogRecord} from "@/src/store/FightStore";
import {FightLog} from "@/src/components/FightDetails";
import {FightResult} from "@/src/components/FightResult";
import {FightStage} from "@/src/components/FightStage";
import {FIGHT_PHASES, BattleHeightProvider, FightActivity, FightHeader, FightNavigation, FightPhase, useCompactFight} from "@/src/components/FightControls";
import {FightPlayback, useFightPlayback} from "@/src/store/useFightPlayback";
import {i18n} from "@/src/translations/i18n";
import {useFightSpeed} from "@/src/store/useFightSpeed";
import {FightSpeed} from "@/src/display/FightMotion";

const styles = StyleSheet.create({
	content: {flex: 1, width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: Theme.spacing.xl, paddingBottom: 12, overflow: "hidden"},
	body: {flex: 1, minHeight: 0, overflow: "hidden"},
	stage: {flex: 1, minHeight: 0, overflow: "hidden"},
	actions: {flexShrink: 0, overflow: "hidden"},
	activitySubtitle: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 15, color: Theme.colors.muted},
	journal: {maxHeight: 480},
	resultActions: {marginTop: 18},
	loading: {flex: 1, alignItems: "center", justifyContent: "center", gap: 14},
	compactContent: {paddingHorizontal: 12, paddingBottom: 8}
});

type FightLiveProps = {fight: FightSnapshot; collector?: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean; onClose: () => void};
type FightContentProps = FightLiveProps & {playback: FightPlayback; navigation: FightNavigation; speed: FightSpeed};

function fightPhase(props: FightLiveProps, playback: FightPlayback): FightPhase {
	if (props.fight.error) return FIGHT_PHASES.ERROR;
	if (playback.record || props.submitting) return FIGHT_PHASES.PLAYING;
	if (props.fight.result) return FIGHT_PHASES.FINISHED;
	return props.collector ? FIGHT_PHASES.SELF : FIGHT_PHASES.OPPONENT;
}

function FightTurn({fight, playback, collector, onChoose, submitting, navigation, speed}: FightContentProps): ReactNode {
	const status = playback.status;
	if (!status) return <View style={styles.loading}><ActivityIndicator color={Theme.colors.muted} /><Text style={styles.activitySubtitle}>{i18n.t("app:battle.preparing")}</Text></View>;
	const pending = submitting || Boolean(playback.record);
	return <View style={styles.body}>
		<View style={styles.stage}><FightStage status={status} introduction={fight.introduction} record={playback.record} onImpact={playback.impact} onComplete={playback.finishMotion} reducedMotion={playback.reducedMotion} speed={speed} /></View>
		<FightActivity entries={playback.logs} ownTurn={Boolean(collector) && !pending} onJournal={navigation.onJournal} />
		<View style={styles.actions}>{collector ? <FightActions key={collector.id} collector={collector} onChoose={onChoose} submitting={pending} /> : <FightActionsWaiting actions={fight.introduction?.initiatorActions ?? []} />}</View>
	</View>;
}

function FightContent(props: FightContentProps): ReactNode {
	const {fight, playback, navigation} = props;
	const closeLabel = i18n.t(fight.introduction?.opponent.monsterId ? "app:adventure.continueReport" : "app:battle.returnToArena");
	if (fight.error) return <View style={styles.loading}><CircleAlert size={38} color={Theme.colors.muted} /><Note>{i18n.t(`app:arena.errors.${fight.error}`)}</Note><Button onPress={navigation.onClose}>{closeLabel}</Button></View>;
	if (!fight.result || playback.record) return <FightTurn {...props} />;
	return <View style={styles.body}><FightResult result={fight.result} reward={fight.reward} monsterReward={fight.monsterReward} /><View style={styles.resultActions}><ButtonRow><Button variant="primary" onPress={navigation.onClose}>{closeLabel}</Button><Button onPress={navigation.onJournal}>{i18n.t("app:arena.log")}</Button></ButtonRow></View></View>;
}

function FightJournal({entries, onClose}: {entries: FightLogRecord[]; onClose: () => void}): ReactNode {
	const {height} = useWindowDimensions();
	const scroll = useRef<ScrollView>(null);
	const positioned = useRef(false);
	const showLatest = (): void => {
		if (positioned.current) return;
		positioned.current = true;
		scroll.current?.scrollToEnd({animated: false});
	};
	return <Sheet
		caption={i18n.t("app:arena.eyebrow")}
		title={i18n.t("app:arena.log")}
		closeLabel={i18n.t("app:battle.backToFight")}
		onClose={onClose}
	><ScrollView ref={scroll} style={[styles.journal, {maxHeight: height * 0.6}]} onContentSizeChange={showLatest}><FightLog entries={entries} /></ScrollView></Sheet>;
}

/** Measures the room the battle really has, so the layout adapts to the device instead of guessing. */
function BattleFrame({height, onHeight, children}: {height: number | null; onHeight: (height: number) => void; children: ReactNode}): ReactNode {
	const compact = useCompactFight();
	return <View testID="fight-frame" style={[styles.content, compact && styles.compactContent]} onLayout={(event): void => {
		const measured = event.nativeEvent.layout.height;
		if (measured > 0 && measured !== height) onHeight(measured);
	}}>{children}</View>;
}

export function FightLiveView(props: FightLiveProps): ReactNode {
	const speedSetting = useFightSpeed();
	const [journal, setJournal] = useState(false);
	const [height, setHeight] = useState<number | null>(null);
	// Reading the journal must not let the live feed run ahead and skip an action.
	const playback = useFightPlayback(props.fight, {speed: speedSetting.speed, paused: journal});
	const navigation = {onClose: props.onClose, onJournal: (): void => setJournal(true)};
	return <BattleHeightProvider height={height}>
		<BattleFrame height={height} onHeight={setHeight}>
			<FightHeader fight={props.fight} playback={playback} phase={fightPhase(props, playback)} />
			<FightContent {...props} playback={playback} navigation={navigation} speed={speedSetting.speed} />
			{journal ? <FightJournal entries={playback.logs} onClose={(): void => setJournal(false)} /> : null}
		</BattleFrame>
	</BattleHeightProvider>;
}