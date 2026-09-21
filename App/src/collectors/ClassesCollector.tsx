import {ReactNode, useState} from "react";
import {Modal} from "react-native";
import {AvailableClass} from "ws-packets/src/objects/ClassDetails";
import {CLASSES_DATA_KINDS, CLASSES_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Button, ButtonRow, Confirmation, Hero, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {ModalSurface} from "@/src/design/Sections";
import {ClassStatistics} from "@/src/components/ClassStatistics";
import {className} from "@/src/display/Classes";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

type ClassChoice = {details: AvailableClass; index: number};
const SECONDS_PER_MINUTE = 60;

function classChoices(collector: ReactionCollectorCreation): ClassChoice[] {
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return [];
	const classes = collector.data.data.classesDetails;
	return collector.reactions.flatMap((reaction, index) => {
		if (reaction.type !== CLASSES_REACTION_KINDS.CHOOSE) return [];
		const details = classes.find(entry => entry.id === reaction.data.classId);
		return details ? [{details, index}] : [];
	});
}

function ClassConfirmation({selection, locked, onConfirm, onCancel}: {selection: ClassChoice; locked: boolean; onConfirm: () => void; onCancel: () => void}): ReactNode {
	return <Confirmation title={i18n.t("app:classes.confirm", {name: i18n.t(`models:classes.${selection.details.id}`)})} onRequestClose={onCancel}>
		<ClassStatistics stats={{...selection.details, fightPoint: selection.details.energy, baseBreath: selection.details.initialBreath}} />
		<ButtonRow>
			<Button variant="primary" disabled={locked} onPress={onConfirm}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={locked} onPress={onCancel}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</Confirmation>;
}

function ClassMenu({collector, locked, secondsLeft, onSelect, onClose}: {
	collector: ReactionCollectorCreation; locked: boolean; secondsLeft: number; onSelect: (choice: ClassChoice) => void; onClose: () => void;
}): ReactNode {
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return null;
	return <Screen>
		<Hero eyebrow={i18n.t("app:profile.eyebrow")} title={i18n.t("app:classes.change")} />
		<Note>{i18n.t("app:classes.cooldownAfter", {duration: formatDurationMinutes(collector.data.data.cooldownSeconds / SECONDS_PER_MINUTE)})}</Note>
		<Panel>{classChoices(collector).map(choice => <Row key={choice.index} title={className(choice.details.id)} disabled={locked} onPress={(): void => onSelect(choice)} chevron />)}</Panel>
		<Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note>
		<ButtonRow><Button disabled={locked} onPress={onClose}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
	</Screen>;
}

export function ClassesCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const [selection, setSelection] = useState<ClassChoice | null>(null);
	const {locked, secondsLeft, answer} = useCollectorAnswer(collector, onChoose, submitting);
	const select = (choice: ClassChoice): void => {
		if (locked) return;
		setSelection(choice);
	};
	const choose = (index: number): void => {
		setSelection(null);
		answer(index);
	};
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return null;
	const close = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<ClassMenu collector={collector} locked={locked} secondsLeft={secondsLeft} onSelect={select} onClose={close} />
			{selection ? <ClassConfirmation selection={selection} locked={locked} onConfirm={(): void => choose(selection.index)} onCancel={(): void => setSelection(null)} /> : null}
		</ModalSurface>
	</Modal>;
}