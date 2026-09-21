import {ReactNode, useState} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Confirmation, Hero, KeyValue, Note, Panel, Row, Screen} from "@/src/design/Primitives";
import {ModalSurface} from "@/src/design/Sections";
import {ExpeditionOptionDetails, ExpeditionProgressDetails} from "@/src/components/ExpeditionDetails";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {isChoosable, reactionLabel} from "@/src/collectors/CollectorLabels";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionLocationName, expeditionPetName, expeditionRisk} from "@/src/display/PetExpedition";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

type ExpeditionData = Extract<ReactionCollectorData, {type: typeof EXPEDITION_DATA_KINDS[keyof typeof EXPEDITION_DATA_KINDS]}>;
const EXPEDITION_KINDS = new Set<ReactionCollectorData["type"]>(Object.values(EXPEDITION_DATA_KINDS));
type MenuProps = {collector: ReactionCollectorCreation; data: ExpeditionData; locked: boolean; onChoose: (index: number) => void};

export function isExpeditionCollector(data: ReactionCollectorData): data is ExpeditionData {
	return EXPEDITION_KINDS.has(data.type);
}

function ExpeditionDataDetails({data}: {data: ExpeditionData}): ReactNode {
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <ExpeditionProgressDetails data={data.data} />;
	if (data.type === EXPEDITION_DATA_KINDS.FINISHED) return <Panel>
		<KeyValue label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data.data)} />
		<KeyValue label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.data.riskCategory)} />
		{data.data.foodConsumed !== undefined ? <KeyValue label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(data.data.foodConsumed)} /> : null}
	</Panel>;
	return <Note>{i18n.t(data.data.hasGuild ? "app:expedition.guildFood" : "app:expedition.noGuildFood", {amount: data.data.guildFoodAmount ?? 0})}</Note>;
}

function RecallChoices({collector, locked, onChoose}: Omit<MenuProps, "data">): ReactNode {
	return <Panel>{collector.reactions.map((reaction, index) => ({reaction, index})).map(choice => <Row
		key={choice.index} title={reactionLabel(choice.reaction, collector.data)} disabled={locked || !isChoosable(choice.reaction, collector.data)}
		onPress={(): void => onChoose(choice.index)} chevron
	/>)}</Panel>;
}

function ExpeditionOptions({collector, data, locked, onChoose}: MenuProps): ReactNode {
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <RecallChoices collector={collector} locked={locked} onChoose={onChoose} />;
	if (data.type !== EXPEDITION_DATA_KINDS.CHOICE) return <CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />;
	return <>
		<Panel>{data.data.expeditions.map(option => <Row key={option.id} title={expeditionLocationName(option)}
			subtitle={i18n.t("app:expedition.optionSummary", {duration: formatDurationMinutes(option.displayDurationMinutes), risk: expeditionRisk(option.riskCategory), count: option.foodCost})}
			disabled={locked} onPress={(): void => onChoose(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.SELECT && reaction.data.expeditionId === option.id))} chevron
		/>)}</Panel>
		<ButtonRow><Button disabled={locked} onPress={(): void => onChoose(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL))}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
	</>;
}

function ExpeditionMenu({secondsLeft, ...props}: MenuProps & {secondsLeft: number}): ReactNode {
	return <Screen>
		<Hero eyebrow={i18n.t("app:pet.eyebrow")} title={i18n.t(`app:expedition.titles.${props.data.type}`)} subtitle={expeditionPetName(props.data.data.pet)} />
		<ExpeditionDataDetails data={props.data} />
		<ExpeditionOptions {...props} />
		{props.data.type !== EXPEDITION_DATA_KINDS.FINISHED ? <Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note> : null}
	</Screen>;
}

function ExpeditionConfirmation({collector, selection, onConfirm, onCancel, locked}: {collector: ReactionCollectorCreation; selection: number; onConfirm: () => void; onCancel: () => void; locked: boolean}): ReactNode {
	const reaction = collector.reactions[selection];
	const option = collector.data.type === EXPEDITION_DATA_KINDS.CHOICE && reaction?.type === EXPEDITION_REACTION_KINDS.SELECT
		? collector.data.data.expeditions.find(entry => entry.id === reaction.data.expeditionId) : null;
	return <Confirmation title={i18n.t(option ? "app:expedition.confirmStart" : "app:expedition.confirmRecall")} onRequestClose={onCancel}>
		{option ? <ExpeditionOptionDetails option={option} /> : <Note>{i18n.t("app:expedition.recallWarning")}</Note>}
		<ButtonRow>
			<Button variant="primary" disabled={locked} onPress={onConfirm}>{i18n.t("app:collector.accept")}</Button>
			<Button disabled={locked} onPress={onCancel}>{i18n.t("app:collector.refuse")}</Button>
		</ButtonRow>
	</Confirmation>;
}

export function PetExpeditionCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const [selection, setSelection] = useState<number | null>(null);
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const choose = (index: number): void => {
		if (locked || index < 0) return;
		const type = collector.reactions[index]?.type;
		if (type === EXPEDITION_REACTION_KINDS.SELECT || type === EXPEDITION_REACTION_KINDS.RECALL) setSelection(index);
		else answer(index);
	};
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL || reaction.type === EXPEDITION_REACTION_KINDS.CLOSE));
	if (!isExpeditionCollector(collector.data)) return null;
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<ExpeditionMenu collector={collector} data={collector.data} locked={locked} onChoose={choose} secondsLeft={secondsLeft} />
			{selection !== null ? <ExpeditionConfirmation collector={collector} selection={selection} locked={locked} onConfirm={(): void => {answer(selection); setSelection(null);}} onCancel={(): void => setSelection(null)} /> : null}
		</ModalSurface>
	</Modal>;
}