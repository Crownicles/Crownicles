import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {isAdventureCollector} from "@/src/collectors/CollectorRouting";
import {Theme} from "@/src/design/Theme";
import {EQUIP_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {EquipCollector} from "@/src/collectors/EquipCollector";

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.xl, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.wash
	}
});

/**
 * Shows every collector waiting for an answer, wherever the player is.
 *
 * A collector is not tied to the screen that opened it, and the server may open one on its own, so
 * it is rendered above the tabs rather than inside a screen.
 */
export function OpenCollectors(): ReactNode {
	const { open, react, isAnswerPending } = useCollectors();
	const fallbackCollectors = open.filter(collector => !isAdventureCollector(collector));

	if (fallbackCollectors.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			{fallbackCollectors.map(collector => collector.data.type === EQUIP_DATA_KINDS.COLLECTOR ? (
				<EquipCollector
					key={collector.id}
					collector={{...collector, data: collector.data}}
					onChoose={(index): void => react(collector.id, index)}
					submitting={isAnswerPending(collector.id)}
				/>
			) : (
				<CollectorPrompt
					key={collector.id}
					collector={collector}
					onChoose={(reactionIndex): void => react(collector.id, reactionIndex)}
					submitting={isAnswerPending(collector.id)}
				/>
			))}
		</View>
	);
}
