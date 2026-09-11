import {ReactNode, useRef, useState} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {AvailableClass} from "ws-packets/src/objects/ClassDetails";
import {CLASSES_DATA_KINDS, CLASSES_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {Button, ButtonRow, Confirmation, Hero, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {ClassStatistics} from "@/src/components/ClassStatistics";
import {className} from "@/src/display/Classes";
import {useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

type ClassChoice = {details: AvailableClass; index: number};
const SECONDS_PER_MINUTE = 60;
const styles = StyleSheet.create({root: {flex: 1, backgroundColor: Theme.colors.paper}});

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

export function ClassesCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const [selection, setSelection] = useState<ClassChoice | null>(null);
	const [answered, setAnswered] = useState(false);
	const sent = useRef(false);
	const secondsLeft = useSecondsLeft(collector.endTime);
	const locked = submitting || answered || secondsLeft === 0;
	const select = (choice: ClassChoice): void => {
		if (locked) return;
		setSelection(choice);
	};
	const choose = (index: number): void => {
		if (index < 0 || Date.now() >= collector.endTime) return;
		if (sent.current || locked) return;
		sent.current = true;
		setAnswered(true);
		setSelection(null);
		onChoose(index);
	};
	if (collector.data.type !== CLASSES_DATA_KINDS.COLLECTOR) return null;
	const close = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <Modal visible animationType="slide" onRequestClose={close}>
		<SafeAreaView style={styles.root}>
			<Screen>
				<Hero eyebrow={i18n.t("app:profile.eyebrow")} title={i18n.t("app:classes.change")} />
				<Note>{i18n.t("app:classes.cooldownAfter", {duration: formatDurationMinutes(collector.data.data.cooldownSeconds / SECONDS_PER_MINUTE)})}</Note>
				<Panel>{classChoices(collector).map(choice => <Row key={choice.index} title={className(choice.details.id)} disabled={locked} onPress={(): void => select(choice)} chevron />)}</Panel>
				<Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note>
				<ButtonRow><Button disabled={locked} onPress={close}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
			</Screen>
			{selection ? <ClassConfirmation selection={selection} locked={locked} onConfirm={(): void => choose(selection.index)} onCancel={(): void => setSelection(null)} /> : null}
		</SafeAreaView>
	</Modal>;
}