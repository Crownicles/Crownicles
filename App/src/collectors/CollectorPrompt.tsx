import {ReactNode, useEffect, useState} from "react";
import {View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_END_POSSIBILITY_ID, BIG_EVENT_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";
import {
	collectorDescription, collectorTitle, isChoosable, reactionLabel
} from "@/src/collectors/CollectorLabels";

function useSecondsLeft(endTime: number): number {
	const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));

	useEffect(() => {
		const interval = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000))), 1000);
		return (): void => clearInterval(interval);
	}, [endTime]);

	return secondsLeft;
}

type IndexedChoice = {
	reaction: ReactionCollectorCreation["reactions"][number];
	index: number;
	key: string;
};

function isServerOnlyChoice(collector: ReactionCollectorCreation, choice: IndexedChoice): boolean {
	return collector.data.type === BIG_EVENT_DATA_KINDS.COLLECTOR
		&& choice.reaction.type === BIG_EVENT_REACTION_KINDS.POSSIBILITY
		&& choice.reaction.data.name === BIG_EVENT_END_POSSIBILITY_ID;
}

function visibleChoices(collector: ReactionCollectorCreation): IndexedChoice[] {
	return collector.reactions
		.map((reaction, index) => ({reaction, index, key: `${collector.id}-${index}`}))
		.filter(choice => !isServerOnlyChoice(collector, choice));
}

function countdownLabel(secondsLeft: number, submitting: boolean): string {
	if (submitting) {
		return i18n.t("app:collector.answering");
	}
	return secondsLeft === 0
		? i18n.t("app:collector.expired")
		: i18n.t("app:collector.timeLeft", {seconds: secondsLeft});
}

function CollectorChoiceRow({choice, collector, locked, onChoose}: {
	choice: IndexedChoice;
	collector: ReactionCollectorCreation;
	locked: boolean;
	onChoose: (choice: IndexedChoice) => void;
}): ReactNode {
	const choosable = isChoosable(choice.reaction, collector.data);
	const disabled = locked || !choosable;
	return <Row
		key={choice.key}
		disabled={disabled}
		onPress={disabled ? undefined : (): void => onChoose(choice)}
		title={reactionLabel(choice.reaction, collector.data)}
		chevron={choosable && !locked}
	/>;
}

/**
 * Renders any collector: a statement, the choices in the order the server sent them, and a
 * countdown. Answering means sending back the position of the choice, so the order must never be
 * altered here.
 * @param collector Collector to display
 * @param onChoose Called with the index of the chosen reaction
 */
export function CollectorChoices({collector, onChoose, submitting = false}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting?: boolean;
}): ReactNode {
	const secondsLeft = useSecondsLeft(collector.endTime);
	const [answeredCollectorId, setAnsweredCollectorId] = useState<string | null>(null);
	const locked = answeredCollectorId === collector.id || submitting || secondsLeft === 0;
	const choose = (choice: IndexedChoice): void => {
		setAnsweredCollectorId(collector.id);
		onChoose(choice.index);
	};

	return (
		<Panel>
			{visibleChoices(collector).map(choice => <CollectorChoiceRow
				key={choice.key}
				choice={choice}
				collector={collector}
				locked={locked}
				onChoose={choose}
			/>)}
			<Note>{countdownLabel(secondsLeft, submitting)}</Note>
		</Panel>
	);
}

export function CollectorPrompt({ collector, onChoose, submitting = false }: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting?: boolean;
}): ReactNode {
	const description = collectorDescription(collector.data);

	return (
		<View>
			<SectionHeader>{collectorTitle(collector.data)}</SectionHeader>
			{description ? <Note>{description}</Note> : null}
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</View>
	);
}
