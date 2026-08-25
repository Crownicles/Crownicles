import {ReactNode, useEffect, useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Note, Panel, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";
import {i18n} from "@/src/translations/i18n";
import {
	collectorDescription, collectorTitle, isChoosable, reactionLabel
} from "@/src/collectors/CollectorLabels";

const styles = StyleSheet.create({
	choice: { paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg },
	choiceLabel: {
		color: Theme.colors.blue,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body
	},
	choiceText: {
		flex: 1
	},
	disabled: { color: Theme.colors.faint }
});

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
	const description = collectorDescription(collector.data);

	// A second press would send a second reaction for a collector that no longer accepts one
	const locked = answered || secondsLeft === 0;
	const choices = collector.reactions.map((reaction, index) => ({
		reaction,
		index,
		key: `${collector.id}-${index}`
	}));

	return (
		<View>
			<SectionHeader>{collectorTitle(collector.data)}</SectionHeader>
			{description ? <Note>{description}</Note> : null}
			<Panel>
				{choices.map((choice) => (
					<Pressable
						key={choice.key}
						disabled={locked || !isChoosable(choice.reaction)}
						onPress={(): void => {
							setAnswered(true);
							onChoose(choice.index);
						}}
						style={styles.choice}
					>
						<TwemojiText
							containerStyle={styles.choiceText}
							textStyle={[styles.choiceLabel, (locked || !isChoosable(choice.reaction)) && styles.disabled]}
							emojiSize={Theme.fontSize.body}
						>
							{reactionLabel(choice.reaction, collector.data)}
						</TwemojiText>
					</Pressable>
				))}
				<Note>
					{secondsLeft === 0 ? i18n.t("app:collector.expired") : i18n.t("app:collector.timeLeft", { seconds: secondsLeft })}
				</Note>
			</Panel>
		</View>
	);
}
