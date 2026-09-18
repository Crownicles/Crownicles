import {ReactNode, useState} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, PET_MANAGEMENT_DATA_KINDS, ReactionCollectorData, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Confirmation, Hero, KeyValue, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {reactionLabel, isChoosable} from "@/src/collectors/CollectorLabels";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionPetName} from "@/src/display/PetExpedition";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({root: {flex: 1, backgroundColor: Theme.colors.paper}});
type Choice = {index: number; reaction: ReactionCollectorReaction};
type ManagementProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};

function TransferMenu({collector, onChoose, submitting}: ManagementProps): ReactNode {
	return <Panel>{collector.reactions.map((reaction, index) => ({reaction, index})).map(choice => <Row key={choice.index}
		title={reactionLabel(choice.reaction, collector.data)} disabled={submitting || !isChoosable(choice.reaction, collector.data)}
		onPress={(): void => onChoose(choice.index)} chevron
	/>)}</Panel>;
}

function ManagementMenu(props: ManagementProps): ReactNode {
	const {collector} = props;
	if (collector.data.type === PET_MANAGEMENT_DATA_KINDS.FREE_CONFIRM) return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t("app:pet.management.free")} subtitle={expeditionPetName(collector.data.data.pet)} />
		<Note>{i18n.t("app:pet.management.irreversible")}</Note>
		<Panel>
			<KeyValue label={i18n.t("app:pet.management.origin")} value={i18n.t(collector.data.data.isFromShelter ? "app:pet.management.shelter" : "app:pet.management.ownPet")} />
			<KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(collector.data.data.freeCost)} />
		</Panel>
		<CollectorChoices {...props} />
	</Screen>;
	return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t(collector.data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER ? "app:pet.management.transfer" : "app:pet.management.free")} />
		{collector.data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER ? <TransferMenu {...props} /> : <CollectorChoices {...props} />}
	</Screen>;
}

function TransferConfirmation({selection, data, locked, onConfirm, onCancel}: {selection: Choice; data: ReactionCollectorData; locked: boolean; onConfirm: () => void; onCancel: () => void}): ReactNode {
	return <Confirmation title={i18n.t("app:pet.management.confirmTransfer")} message={reactionLabel(selection.reaction, data)} onRequestClose={onCancel}>
		<ButtonRow>
			<Button variant="primary" disabled={locked} onPress={onConfirm}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={locked} onPress={onCancel}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</Confirmation>;
}

export function PetManagementCollector({collector, onChoose, submitting}: ManagementProps): ReactNode {
	const [selection, setSelection] = useState<Choice | null>(null);
	const {answer, locked} = useCollectorAnswer(collector, onChoose, submitting);
	const choose = (index: number): void => {
		if (locked || index < 0) return;
		const reaction = collector.reactions[index];
		if (collector.data.type === PET_MANAGEMENT_DATA_KINDS.TRANSFER && reaction.type !== GENERIC_REACTION_KINDS.REFUSE) setSelection({index, reaction});
		else answer(index);
	};
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	return <Modal visible animationType="slide" onRequestClose={close}>
		<SafeAreaView style={styles.root}>
			<ManagementMenu collector={collector} onChoose={choose} submitting={locked} />
			{selection ? <TransferConfirmation selection={selection} data={collector.data} locked={locked} onConfirm={(): void => {answer(selection.index); setSelection(null);}} onCancel={(): void => setSelection(null)} /> : null}
		</SafeAreaView>
	</Modal>;
}