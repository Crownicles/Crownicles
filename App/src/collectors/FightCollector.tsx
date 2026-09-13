import {ReactNode, useEffect} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useQueryClient} from "@tanstack/react-query";
import {FIGHT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {Theme} from "@/src/design/Theme";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {fightStore, useFight, FightSnapshot} from "@/src/store/FightStore";
import {FIGHT_ERRORS} from "ws-packets/src/objects/Fight";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {FightLiveView} from "@/src/components/FightBattle";

const styles = StyleSheet.create({
	root: {flex: 1, backgroundColor: Theme.colors.paper}
});

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
