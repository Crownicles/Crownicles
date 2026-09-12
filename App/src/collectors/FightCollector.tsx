import {ReactNode, useEffect, useState} from "react";
import {Modal, StyleSheet, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useQueryClient} from "@tanstack/react-query";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {FIGHT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Button, Note, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {FightActions} from "@/src/collectors/FightActionCollector";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {fightStore, useFight, FightSnapshot} from "@/src/store/FightStore";
import {FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {FighterDetails, FightLog, FightResult} from "@/src/components/FightDetails";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	root: {flex: 1, backgroundColor: Theme.colors.paper},
	participants: {flexDirection: "row", gap: Theme.spacing.md},
	header: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Theme.spacing.md},
	title: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: Theme.colors.ink}
});

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
		for (const entity of [GAME_ENTITIES.PROFILE, GAME_ENTITIES.PET, GAME_ENTITIES.MISSIONS, GAME_ENTITIES.REPORT, GAME_ENTITIES.FIGHT_HISTORY, GAME_ENTITIES.LEAGUES, GAME_ENTITIES.RANKINGS]) queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(console.error);
	}, [completed, queryClient]);
	return Boolean(completed);
}

function FightHeader({finished, onClose}: {finished: boolean; onClose: () => void}): ReactNode {
	return <View style={styles.header}>
		<Text style={styles.title}>{i18n.t("app:arena.title")}</Text>
		<Button onPress={onClose}>{i18n.t(finished ? "app:common.back" : "app:arena.minimize")}</Button>
	</View>;
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
			<FightHeader finished={Boolean(fight.result || fight.error)} onClose={close} />
			<FightLiveView fight={fight} collector={collector} onChoose={(index): void => {if (collector) react(collector.id, index);}} submitting={collector ? isAnswerPending(collector.id) : false} />
		</Screen></SafeAreaView>
	</Modal>;
}
