import {ReactNode} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, EntryRow, ExpandableEntry, ExpandableList, Fact, ModalSurface, Standing} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
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
type Unfolding = ExpandedEntry<number>;
type MenuProps = {
	collector: ReactionCollectorCreation;
	data: ExpeditionData;
	locked: boolean;
	onChoose: (index: number) => void;
	unfolding: Unfolding;
};

export function isExpeditionCollector(data: ReactionCollectorData): data is ExpeditionData {
	return EXPEDITION_KINDS.has(data.type);
}

function ExpeditionDataDetails({data}: {data: ExpeditionData}): ReactNode {
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <ExpeditionProgressDetails data={data.data} />;
	if (data.type === EXPEDITION_DATA_KINDS.FINISHED) return <ExpandableList>
		<Fact label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data.data)} />
		<Fact label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.data.riskCategory)} />
		{data.data.foodConsumed !== undefined ? <Fact label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(data.data.foodConsumed)} /> : null}
	</ExpandableList>;
	return <Note>{i18n.t(data.data.hasGuild ? "app:expedition.guildFood" : "app:expedition.noGuildFood", {amount: data.data.guildFoodAmount ?? 0})}</Note>;
}

/** A choice is confirmed where it was made: recalling states its price on the row itself. */
function ExpeditionChoice({label, index, locked, unfolding, onChoose, confirmLabel, children}: {
	label: string;
	index: number;
	locked: boolean;
	unfolding: Unfolding;
	onChoose: (index: number) => void;
	confirmLabel: string;
	children: ReactNode;
}): ReactNode {
	return <ExpandableEntry
		label={label}
		dimmed={locked}
		expanded={unfolding.isExpanded(index)}
		onToggle={(): void => unfolding.toggle(index)}
	>
		{children}
		<ActionBanner icon={Check} label={confirmLabel} pending={locked} onPress={(): void => onChoose(index)} />
	</ExpandableEntry>;
}

function RecallChoices({collector, locked, onChoose, unfolding}: Omit<MenuProps, "data">): ReactNode {
	// A reaction is known by its index: that is what the answer sends back.
	const choices = collector.reactions.map((reaction, index) => ({reaction, index}));
	return <ExpandableList>{choices.map(({reaction, index}) => reaction.type === EXPEDITION_REACTION_KINDS.RECALL
		? <ExpeditionChoice
			key={index}
			label={reactionLabel(reaction, collector.data)}
			index={index}
			locked={locked}
			unfolding={unfolding}
			onChoose={onChoose}
			confirmLabel={i18n.t("app:expedition.confirmRecall")}
		><Note>{i18n.t("app:expedition.recallWarning")}</Note></ExpeditionChoice>
		: <EntryRow
			key={index}
			title={reactionLabel(reaction, collector.data)}
			disabled={locked || !isChoosable(reaction, collector.data)}
			onPress={(): void => onChoose(index)}
		/>)}</ExpandableList>;
}

function ExpeditionOptions({collector, data, locked, onChoose, unfolding}: MenuProps): ReactNode {
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <RecallChoices collector={collector} locked={locked} onChoose={onChoose} unfolding={unfolding} />;
	if (data.type !== EXPEDITION_DATA_KINDS.CHOICE) return <CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />;
	return <>
		<ExpandableList>{data.data.expeditions.map(option => {
			const index = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.SELECT && reaction.data.expeditionId === option.id);
			return <ExpeditionChoice
				key={option.id}
				label={expeditionLocationName(option)}
				index={index}
				locked={locked}
				unfolding={unfolding}
				onChoose={onChoose}
				confirmLabel={i18n.t("app:expedition.confirmStart")}
			>
				<Note>{i18n.t("app:expedition.optionSummary", {duration: formatDurationMinutes(option.displayDurationMinutes), risk: expeditionRisk(option.riskCategory), count: option.foodCost})}</Note>
				<ExpeditionOptionDetails option={option} />
			</ExpeditionChoice>;
		})}</ExpandableList>
		<ButtonRow><Button disabled={locked} onPress={(): void => onChoose(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL))}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
	</>;
}

function ExpeditionMenu({secondsLeft, ...props}: MenuProps & {secondsLeft: number}): ReactNode {
	return <Screen>
		<Standing caption={i18n.t("app:pet.eyebrow")} title={i18n.t(`app:expedition.titles.${props.data.type}`)} subtitle={expeditionPetName(props.data.data.pet)} />
		<ExpeditionDataDetails data={props.data} />
		<ExpeditionOptions {...props} />
		{props.data.type !== EXPEDITION_DATA_KINDS.FINISHED ? <Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note> : null}
	</Screen>;
}

export function PetExpeditionCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const unfolding = useExpandedEntry<number>();
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const choose = (index: number): void => {
		if (locked || index < 0) return;
		unfolding.collapse();
		answer(index);
	};
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL || reaction.type === EXPEDITION_REACTION_KINDS.CLOSE));
	if (!isExpeditionCollector(collector.data)) return null;
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface>
			<ExpeditionMenu
				collector={collector}
				data={collector.data}
				locked={locked}
				onChoose={choose}
				unfolding={unfolding}
				secondsLeft={secondsLeft}
			/>
		</ModalSurface>
	</Modal>;
}
