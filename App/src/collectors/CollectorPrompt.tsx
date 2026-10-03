import {ReactNode, useEffect, useState} from "react";
import {Pressable, Text, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_END_POSSIBILITY_ID, BIG_EVENT_REACTION_KINDS, GENERIC_REACTION_KINDS
} from "ws-packets/src/fromServer/collectors";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";
import {
	collectorDescription, collectorTitle, isChoosable, reactionLabel
} from "@/src/collectors/CollectorLabels";
import {ActionBanner, ChoiceAction} from "@/src/design/Sections";
import {Check, LucideIcon} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {clockTime} from "@/src/display/Clock";

export function useSecondsLeft(endTime: number): number {
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

const useDecisionStyles = createStyles(colors => ({
	decision: {marginTop: Theme.spacing.xl, gap: Theme.spacing.sm},
	cancel: {alignItems: "center", paddingVertical: Theme.spacing.md},
	cancelLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.bodySmall, color: colors.muted},
	pressed: {opacity: 0.6}
}));

const useChoiceStyles = createStyles(() => ({
	choices: {gap: Theme.spacing.md},
	actions: {gap: Theme.spacing.sm}
}));

/** A yes-or-no collector inside a popup: the answer the screen is about stands out, backing out stays discreet. */
export function CollectorDecision({collector, onChoose, submitting, acceptLabel, acceptIcon = Check, cancelLabel}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
	acceptLabel?: string;
	acceptIcon?: LucideIcon;
	cancelLabel?: string;
}): ReactNode {
	const styles = useDecisionStyles();
	const accept = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT);
	const refuse = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	return <View style={styles.decision}>
		<ActionBanner icon={acceptIcon} label={acceptLabel ?? i18n.t("app:collector.accept")} pending={submitting} onPress={(): void => onChoose(accept)} testID="collector-accept" />
		<Pressable accessibilityRole="button" disabled={submitting} onPress={(): void => onChoose(refuse)} style={({pressed}): object[] => [styles.cancel, pressed && styles.pressed].filter(Boolean) as object[]}>
			<Text style={styles.cancelLabel}>{cancelLabel ?? i18n.t("app:collector.refuse")}</Text>
		</Pressable>
	</View>;
}

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

export function countdownLabel(secondsLeft: number, submitting: boolean): string {
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
	return <ChoiceAction
		key={choice.key}
		disabled={disabled}
		onPress={(): void => {if (!disabled) onChoose(choice);}}
		label={reactionLabel(choice.reaction, collector.data)}
	/>;
}

/**
 * Renders any collector: a statement, the choices in the order the server sent them, and a
 * reply deadline. Answering means sending back the position of the choice, so the order must never be
 * altered here.
 * @param collector Collector to display
 * @param onChoose Called with the index of the chosen reaction
 */
export function CollectorChoices({collector, onChoose, submitting = false}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting?: boolean;
}): ReactNode {
	const styles = useChoiceStyles();
	const secondsLeft = useSecondsLeft(collector.endTime);
	const [answeredCollectorId, setAnsweredCollectorId] = useState<string | null>(null);
	const locked = answeredCollectorId === collector.id || submitting || secondsLeft === 0;
	const choose = (choice: IndexedChoice): void => {
		setAnsweredCollectorId(collector.id);
		onChoose(choice.index);
	};

	return (
		<View style={styles.choices}>
			<SectionHeader>{i18n.t("app:collector.yourAction")}</SectionHeader>
			<View style={styles.actions}>{visibleChoices(collector).map(choice => <CollectorChoiceRow
				key={choice.key}
				choice={choice}
				collector={collector}
				locked={locked}
				onChoose={choose}
			/>)}</View>
			<Note>{submitting || answeredCollectorId === collector.id
				? i18n.t("app:collector.answering")
				: secondsLeft === 0
					? i18n.t("app:collector.expired")
					: i18n.t("app:collector.replyBefore", {time: clockTime(collector.endTime)})}</Note>
		</View>
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
