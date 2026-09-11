import {ReactNode} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS, DRINK_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {Hero, KeyValue, Panel, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {consumableDescription} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

type ConsumableCollectorProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

const styles = StyleSheet.create({root: {flex: 1, backgroundColor: Theme.colors.paper}});

function ConsumableMenu({collector, onChoose, submitting}: ConsumableCollectorProps): ReactNode {
	const items = collector.reactions.flatMap(reaction => {
		if (reaction.type === DRINK_REACTION_KINDS.POTION) return [reaction.data.potion];
		if (reaction.type === DAILY_BONUS_REACTION_KINDS.OBJECT) return [reaction.data.object];
		return [];
	});
	return <Screen>
		<Hero eyebrow={i18n.t("app:equipment.eyebrow")} title={i18n.t(collector.data.type === DAILY_BONUS_DATA_KINDS.COLLECTOR ? "app:dailyBonus.title" : "app:inventoryActions.drinkTitle")} />
		<Panel>{items.map((item, index) => <KeyValue key={`${item.id}-${index}`} label={itemDisplayName(item)} value={consumableDescription(item)} />)}</Panel>
		<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
	</Screen>;
}

export function ConsumableCollector(props: ConsumableCollectorProps): ReactNode {
	const refuseIndex = props.collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const close = (): void => {
		if (props.submitting) return;
		if (refuseIndex >= 0) props.onChoose(refuseIndex);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<SafeAreaView style={styles.root}><ConsumableMenu {...props} /></SafeAreaView>
	</Modal>;
}
