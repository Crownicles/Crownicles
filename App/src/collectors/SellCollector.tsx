import {ReactNode, useRef, useState} from "react";
import {Modal, StyleSheet} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, ReactionCollectorReaction, SELL_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {SellRes} from "ws-packets/src/fromServer/inventory/SellRes";
import {Button, ButtonRow, Confirmation, Hero, KeyValue, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {itemCategoryLabel, itemDisplayName} from "@/src/collectors/CollectorLabels";
import {formatMoney} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type SaleChoice = {reaction: Extract<ReactionCollectorReaction, {type: typeof SELL_REACTION_KINDS.ITEM}>; index: number};

const styles = StyleSheet.create({root: {flex: 1, backgroundColor: Theme.colors.paper}});

function saleChoices(collector: ReactionCollectorCreation): SaleChoice[] {
	return collector.reactions.flatMap((reaction, index) => reaction.type === SELL_REACTION_KINDS.ITEM ? [{reaction, index}] : []);
}

export function SaleOutcome({outcome, onContinue}: {outcome: SellRes; onContinue: () => void}): ReactNode {
	return <Confirmation
		title={i18n.t(outcome.price === 0 ? "app:sale.discarded" : "app:sale.sold")}
		message={itemDisplayName(outcome.item)}
		onRequestClose={onContinue}
	>
		{outcome.price > 0 ? <Panel><KeyValue label={i18n.t("app:sale.received")} value={formatMoney(outcome.price)} /></Panel> : null}
		<ButtonRow><Button variant="primary" onPress={onContinue}>{i18n.t("app:sale.continue")}</Button></ButtonRow>
	</Confirmation>;
}

function SaleRow({choice, locked, onSelect}: {choice: SaleChoice; locked: boolean; onSelect: (choice: SaleChoice) => void}): ReactNode {
	const {item, slot, price} = choice.reaction.data;
	return <Row
		title={itemDisplayName(item)}
		subtitle={i18n.t("app:sale.itemSlot", {category: itemCategoryLabel(item.category), slot})}
		end={price === 0 ? i18n.t("app:sale.discard") : formatMoney(price)}
		disabled={locked}
		onPress={(): void => onSelect(choice)}
		chevron
	/>;
}

function SaleMenu({collector, locked, onSelect, onClose}: {
	collector: ReactionCollectorCreation;
	locked: boolean;
	onSelect: (choice: SaleChoice) => void;
	onClose: () => void;
}): ReactNode {
	return <Screen>
		<Hero eyebrow={i18n.t("app:sale.eyebrow")} title={i18n.t("app:sale.title")} />
		<Panel>{saleChoices(collector).map(choice => <SaleRow key={choice.index} choice={choice} locked={locked} onSelect={onSelect} />)}</Panel>
		{locked ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		<ButtonRow><Button disabled={locked} onPress={onClose}>{i18n.t("app:sale.continue")}</Button></ButtonRow>
	</Screen>;
}

function SaleConfirmation({selection, locked, onChoose, onCancel}: {
	selection: SaleChoice;
	locked: boolean;
	onChoose: (index: number) => void;
	onCancel: () => void;
}): ReactNode {
	return <Confirmation
		title={i18n.t(selection.reaction.data.price === 0 ? "app:sale.confirmDiscard" : "app:sale.confirmSell")}
		message={itemDisplayName(selection.reaction.data.item)}
		onRequestClose={onCancel}
	>
		<Panel><KeyValue label={i18n.t("app:sale.price")} value={formatMoney(selection.reaction.data.price)} /></Panel>
		<ButtonRow>
			<Button variant="primary" disabled={locked} onPress={(): void => onChoose(selection.index)}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={locked} onPress={onCancel}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</Confirmation>;
}

export function SellCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean;
}): ReactNode {
	const [selection, setSelection] = useState<SaleChoice | null>(null);
	const [answered, setAnswered] = useState(false);
	const sent = useRef(false);
	const locked = submitting || answered;
	const refuseIndex = collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const choose = (index: number): void => {
		if (index < 0) return;
		if (sent.current || locked) return;
		sent.current = true;
		setAnswered(true);
		setSelection(null);
		onChoose(index);
	};
	const close = (): void => choose(refuseIndex);
	return <Modal visible animationType="slide" onRequestClose={close}>
		<SafeAreaView style={styles.root}>
			<SaleMenu collector={collector} locked={locked} onSelect={setSelection} onClose={close} />
			{selection ? <SaleConfirmation selection={selection} locked={locked} onChoose={choose} onCancel={(): void => setSelection(null)} /> : null}
		</SafeAreaView>
	</Modal>;
}
