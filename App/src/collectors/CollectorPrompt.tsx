import {ReactNode, useEffect, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {collectorTitle, isChoosable, reactionLabel} from "@/src/collectors/CollectorLabels";

function useSecondsLeft(endTime: number): number {
	const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));

	useEffect(() => {
		const interval = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000))), 1000);
		return (): void => clearInterval(interval);
	}, [endTime]);

	return secondsLeft;
}

/**
 * Renders any collector: a statement, the choices in the order the server sent them, and a
 * countdown. Answering means sending back the position of the choice, so the order must never be
 * altered here.
 * @param collector Collector to display
 * @param onChoose Called with the index of the chosen reaction
 */
export function CollectorPrompt({ collector, onChoose }: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
}): ReactNode {
	const secondsLeft = useSecondsLeft(collector.endTime);
	const [answered, setAnswered] = useState(false);

	// A second press would send a second reaction for a collector that no longer accepts one
	const locked = answered || secondsLeft === 0;

	return (
		<View>
			<SectionHeader>{collectorTitle(collector.data)}</SectionHeader>
			<Panel>
				{collector.reactions.map((reaction, index) => (
					<Pressable
						key={`${reaction.type}-${index}`}
						disabled={locked || !isChoosable(reaction)}
						onPress={(): void => {
							setAnswered(true);
							onChoose(index);
						}}
						style={styles.choice}
					>
						<Text style={[styles.choiceLabel, (locked || !isChoosable(reaction)) && styles.disabled]}>
							{reactionLabel(reaction)}
						</Text>
					</Pressable>
				))}
				<Note>
					{secondsLeft === 0 ? i18n.t("app:collector.expired") : i18n.t("app:collector.timeLeft", { seconds: secondsLeft })}
				</Note>
			</Panel>
		</View>
	);
}

const styles = StyleSheet.create({
	choice: { paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg },
	choiceLabel: { color: Theme.colors.blue, fontSize: Theme.fontSize.body },
	disabled: { color: Theme.colors.faint }
});
