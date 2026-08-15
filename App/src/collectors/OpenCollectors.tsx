import {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {useCollectors} from "@/src/collectors/CollectorsContext";
import {CollectorPrompt} from "@/src/collectors/CollectorPrompt";
import {Theme} from "@/src/design/Theme";

/**
 * Shows every collector waiting for an answer, wherever the player is.
 *
 * A collector is not tied to the screen that opened it, and the server may open one on its own, so
 * it is rendered above the tabs rather than inside a screen.
 */
export function OpenCollectors(): ReactNode {
	const { open, react } = useCollectors();

	if (open.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			{open.map(collector => (
				<CollectorPrompt
					key={collector.id}
					collector={collector}
					onChoose={(reactionIndex): void => react(collector.id, reactionIndex)}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: Theme.spacing.xl, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.wash
	}
});
