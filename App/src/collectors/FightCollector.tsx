import {ReactNode, useEffect, useState} from "react";
import {Modal, StyleSheet, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useQueryClient} from "@tanstack/react-query";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS, FIGHT_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {Button, Confirmation, KeyValue, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {fightStore, useFight, FightSnapshot} from "@/src/store/FightStore";
import {FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {FighterDetails, FightLog, FightResult} from "@/src/components/FightDetails";
import {fightActionName} from "@/src/display/Fight";
import {className} from "@/src/display/Classes";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type CollectorProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};
const styles = StyleSheet.create({
	root: {flex: 1, backgroundColor: Theme.colors.paper},
	participants: {flexDirection: "row", gap: Theme.spacing.md},
	header: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Theme.spacing.md},
	title: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: Theme.colors.ink}
});

export function FightConfirmCollector({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	if (collector.data.type !== FIGHT_DATA_KINDS.CONFIRM) return null;
	const stats = collector.data.data.playerStats;
	return <Confirmation title={i18n.t("app:arena.confirm")} onRequestClose={(): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE))}>
		<Panel>
			<KeyValue label={i18n.t("app:arena.class")} value={className(stats.classId)} />
			<KeyValue label={i18n.t("app:arena.energy")} value={i18n.t("app:profile.formats.progress", {value: stats.energy.value, max: stats.energy.max})} />
			<KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(stats.fightRanking.glory)} />
			{(["attack", "defense", "speed"] as const).map(stat => <KeyValue key={stat} label={i18n.t(`app:arena.stats.${stat}`)} value={formatNumber(stats[stat])} />)}
			{stats.pet ? <KeyValue label={i18n.t("app:arena.pet")} value={expeditionPetName(stats.pet)} /> : null}
		</Panel>
		{stats.pet?.isOnExpedition ? <Note>{i18n.t("app:pet.powers.expedition")}</Note> : null}
		<CollectorChoices collector={collector} onChoose={answer} submitting={locked} />
	</Confirmation>;
}

export function FightActions({collector, onChoose, submitting}: CollectorProps): ReactNode {
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const {introduction} = useFight();
	const choices = collector.reactions.map((reaction, index) => ({reaction, index, key: `${collector.id}:${index}`}));
	return <Panel>
		{choices.map(({reaction, index, key}) => {
			if (reaction.type !== FIGHT_REACTION_KINDS.ACTION) return <Row key={key} title={i18n.t("app:collector.unknownChoice")} disabled />;
			const breath = introduction?.initiatorActions.find(([id]) => id === reaction.data.id)?.[1];
			return <Row key={key} title={fightActionName(reaction.data.id)} subtitle={i18n.t(`models:fight_actions.${reaction.data.id}.description`, {defaultValue: ""})}
				{...(breath === undefined ? {} : {end: i18n.t("app:arena.actionBreath", {value: breath})})} disabled={locked} onPress={(): void => answer(index)} chevron />;
		})}
		<Note>{i18n.t(submitting ? "app:collector.answering" : "app:collector.timeLeft", {seconds: secondsLeft})}</Note>
	</Panel>;
}

type FightLiveProps = {fight: FightSnapshot; collector?: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

function FightTurnView({fight, collector, onChoose, submitting}: FightLiveProps): ReactNode {
	if (fight.result || fight.error) return null;
	return <>
		{fight.status ? <>
			<Note>{i18n.t("app:arena.turn", {turn: fight.status.numberOfTurn, max: fight.status.maxNumberOfTurn})}</Note>
			<View style={styles.participants}><FighterDetails fighter={fight.status.activeFighter} /><FighterDetails fighter={fight.status.defendingFighter} /></View>
		</> : null}
		{collector ? <FightActions key={collector.id} collector={collector} onChoose={onChoose} submitting={submitting} /> : <Note>{i18n.t("app:arena.waiting")}</Note>}
	</>;
}

function FightLiveView(props: FightLiveProps): ReactNode {
	const {fight} = props;
	const [tab, setTab] = useState("turn");
	return <>
		<SegmentedControl label={i18n.t("app:arena.title")} value={tab} onChange={setTab} options={[{value: "turn", label: i18n.t("app:arena.currentTurn")}, {value: "log", label: i18n.t("app:arena.log")}]} />
		{fight.error ? <Note>{i18n.t(`app:arena.errors.${fight.error}`)}</Note> : null}
		{fight.result ? <FightResult result={fight.result} reward={fight.reward} /> : null}
		{tab === "log" ? <FightLog entries={fight.logs} /> : <FightTurnView {...props} />}
	</>;
}

function useFightCompletion(fight: FightSnapshot): boolean {
	const queryClient = useQueryClient();
	const completed = fight.reward ?? (fight.introduction?.opponent.monsterId ? fight.result : null) ?? (fight.error === FIGHT_ERRORS.BUGGED ? fight.error : null);
	useEffect(() => {
		if (!completed) return;
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.PET, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}, [completed, queryClient]);
	return Boolean(completed);
}

export function FightSession(): ReactNode {
	const fight = useFight();
	const {open, react, isAnswerPending} = useCollectors();
	const completed = useFightCompletion(fight);
	const collector = open.find(entry => entry.data.type === FIGHT_DATA_KINDS.ACTION);
	if (!fight.visible) return null;
	const close = completed || fight.error ? fightStore.reset : fightStore.minimize;
	return <Modal visible animationType="slide" onRequestClose={fightStore.minimize}>
		<SafeAreaView style={styles.root}><Screen>
			<View style={styles.header}><Text style={styles.title}>{i18n.t("app:arena.title")}</Text><Button onPress={close}>{i18n.t(fight.result || fight.error ? "app:common.back" : "app:arena.minimize")}</Button></View>
			<FightLiveView fight={fight} collector={collector} onChoose={(index): void => {if (collector) react(collector.id, index);}} submitting={collector ? isAnswerPending(collector.id) : false} />
		</Screen></SafeAreaView>
	</Modal>;
}
