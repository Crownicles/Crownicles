import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {isAdventureCollector} from "@/src/collectors/CollectorRouting";
import {Theme} from "@/src/design/Theme";
import {CLASSES_DATA_KINDS, DAILY_BONUS_DATA_KINDS, DRINK_DATA_KINDS, EQUIP_DATA_KINDS, PET_FEED_DATA_KINDS, SELL_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {EquipCollector} from "@/src/collectors/EquipCollector";
import {SellCollector} from "@/src/collectors/SellCollector";
import {useInventoryOutcome} from "@/src/store/useInventoryOutcome";
import {InventoryOutcome} from "@/src/collectors/InventoryOutcome";
import {ConsumableCollector} from "@/src/collectors/ConsumableCollector";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {ClassesCollector} from "@/src/collectors/ClassesCollector";
import {ClassOutcome} from "@/src/collectors/ClassOutcome";
import {useClassOutcome} from "@/src/store/useClassOutcome";
import {usePetFeedOutcome} from "@/src/store/usePetFeedOutcome";
import {PetFeedCollector} from "@/src/collectors/PetFeedCollector";
import {PetFeedOutcome} from "@/src/collectors/PetFeedOutcome";
import {isExpeditionCollector, PetExpeditionCollector} from "@/src/collectors/PetExpeditionCollector";
import {useExpeditionOutcome} from "@/src/store/useExpeditionOutcome";
import {PetExpeditionOutcome} from "@/src/collectors/PetExpeditionOutcome";
import {isPetManagementCollector, PetManagementCollector} from "@/src/collectors/PetManagementCollector";
import {PetManagementOutcome} from "@/src/collectors/PetManagementOutcome";
import {usePetManagementOutcome} from "@/src/store/usePetManagementOutcome";

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.xl, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.wash
	}
});

function InventoryCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	if (isPetManagementCollector(collector.data)) return <PetManagementCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	if (isExpeditionCollector(collector.data)) return <PetExpeditionCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	if (collector.data.type === PET_FEED_DATA_KINDS.GUILD || collector.data.type === PET_FEED_DATA_KINDS.PERSONAL) return <PetFeedCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
	if (collector.data.type === CLASSES_DATA_KINDS.COLLECTOR) return <ClassesCollector collector={collector} onChoose={onChoose} submitting={submitting} />;
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
	const classOutcome = useClassOutcome();
	const feedOutcome = usePetFeedOutcome();
	const expeditionOutcome = useExpeditionOutcome();
	const managementOutcome = usePetManagementOutcome();
	const fallbackCollectors = open.filter(collector => !isAdventureCollector(collector));
	const outcomePending = [outcome, classOutcome.outcome, feedOutcome.outcome, expeditionOutcome.outcome, managementOutcome.outcome].some(Boolean);

	if (fallbackCollectors.length === 0 && !outcomePending) {
		return null;
	}

	return (
		<View style={styles.container}>
			{managementOutcome.outcome ? <PetManagementOutcome outcome={managementOutcome.outcome} onContinue={managementOutcome.clear} /> : null}
			{expeditionOutcome.outcome ? <PetExpeditionOutcome outcome={expeditionOutcome.outcome} onContinue={expeditionOutcome.clear} /> : null}
			{feedOutcome.outcome ? <PetFeedOutcome outcome={feedOutcome.outcome} onContinue={feedOutcome.clear} /> : null}
			{classOutcome.outcome ? <ClassOutcome outcome={classOutcome.outcome} onContinue={classOutcome.clear} /> : null}
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
