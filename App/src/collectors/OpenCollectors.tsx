import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {isAdventureCollector} from "@/src/collectors/CollectorRouting";
import {Theme} from "@/src/design/Theme";
import {DAILY_BONUS_DATA_KINDS, DRINK_DATA_KINDS, EQUIP_DATA_KINDS, SELL_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {EquipCollector} from "@/src/collectors/EquipCollector";
import {SellCollector} from "@/src/collectors/SellCollector";
import {useInventoryOutcome} from "@/src/store/useInventoryOutcome";
import {InventoryOutcome} from "@/src/collectors/InventoryOutcome";
import {ConsumableCollector} from "@/src/collectors/ConsumableCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.xl, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.wash
	}
});

function InventoryCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	if (collector.data.type === EQUIP_DATA_KINDS.COLLECTOR) return <EquipCollector collector={{...collector, data: collector.data}} onChoose={onChoose} submitting={submitting} />;
	if (collector.data.type === SELL_DATA_KINDS.COLLECTOR) return <SellCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	const consumable = collector.data.type === DAILY_BONUS_DATA_KINDS.COLLECTOR || collector.data.type === DRINK_DATA_KINDS.COLLECTOR;
	if (consumable) return <ConsumableCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	return <CollectorPrompt collector={collector} onChoose={onChoose} submitting={submitting} />;
}

/**
 * Shows every collector waiting for an answer, wherever the player is.
 *
 * A collector is not tied to the screen that opened it, and the server may open one on its own, so
 * it is rendered above the tabs rather than inside a screen.
 */
export function OpenCollectors(): ReactNode {
	const { open, react, isAnswerPending } = useCollectors();
	const {outcome, clear} = useInventoryOutcome();
	const fallbackCollectors = open.filter(collector => !isAdventureCollector(collector));

	if (fallbackCollectors.length === 0 && !outcome) {
		return null;
	}

	return (
		<View style={styles.container}>
			{outcome ? <InventoryOutcome outcome={outcome} onContinue={clear} /> : null}
			{fallbackCollectors.map(collector => (
				<InventoryCollector
					key={collector.id}
					collector={collector}
					onChoose={(reactionIndex): void => react(collector.id, reactionIndex)}
					submitting={isAnswerPending(collector.id)}
				/>
			))}
		</View>
	);
}
