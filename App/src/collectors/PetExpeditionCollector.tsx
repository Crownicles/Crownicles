import {ReactNode, useState} from "react";
import {View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, EntryRow, ExpandableEntry, ExpandableList, Fact, ModalSurface, SheetModal, Standing} from "@/src/design/Sections";
import {Check, Flag} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {ExpandedEntry, useExpandedEntry} from "@/src/design/useExpandedEntry";
import {ExpeditionOptionRow, ExpeditionProgressDetails} from "@/src/components/ExpeditionDetails";
import {ImpatientPet} from "@/src/components/PetReaction";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {isChoosable, reactionLabel} from "@/src/collectors/CollectorLabels";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionLocationName, expeditionPetIcon, expeditionPetName, expeditionRisk} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";

const PET_EMBLEM_SIZE = 34;

const useStyles = createStyles(() => ({
	options: {gap: Theme.spacing.sm, marginBottom: Theme.spacing.lg},
	intro: {marginBottom: Theme.spacing.lg}
}));

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

type ChoiceData = Extract<ExpeditionData, {type: typeof EXPEDITION_DATA_KINDS.CHOICE}>["data"];

/** Who leaves and what the guild can pack for the trip, in the line under the title. */
function menuSubtitle(data: ExpeditionData): string {
	const pet = expeditionPetName(data.data.pet);
	if (data.type !== EXPEDITION_DATA_KINDS.CHOICE) return pet;
	return data.data.hasGuild && data.data.guildFoodAmount !== undefined
		? i18n.t("app:expedition.provisions", {pet, rations: i18n.t("commands:petExpedition.foodCost", {count: data.data.guildFoodAmount})})
		: i18n.t("app:expedition.noProvisions", {pet});
}

function ExpeditionDataDetails({data}: {data: ExpeditionData}): ReactNode {
	const styles = useStyles();
	if (data.type === EXPEDITION_DATA_KINDS.CHOICE) return <View style={styles.intro}>
		<Story>{i18n.t("commands:petExpedition.chooseExpedition", {petDisplay: `**${expeditionPetName(data.data.pet)}**`})}</Story>
	</View>;
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <ExpeditionProgressDetails data={data.data} />;
	return <ExpandableList>
		<Fact label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data.data)} />
		<Fact label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.data.riskCategory)} />
		{data.data.foodConsumed !== undefined ? <Fact label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(data.data.foodConsumed)} /> : null}
	</ExpandableList>;
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

/** The three destinations fit on one screen: a tap picks one, the single button below sends the pet there. */
function DestinationChoices({collector, data, locked, onChoose}: {collector: ReactionCollectorCreation; data: ChoiceData; locked: boolean; onChoose: (index: number) => void}): ReactNode {
	const styles = useStyles();
	const [selected, setSelected] = useState<string | null>(null);
	const chosenIndex = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.SELECT && reaction.data.expeditionId === selected);
	return <>
		<View style={styles.options}>{data.expeditions.map(option => <ExpeditionOptionRow
			key={option.id}
			option={option}
			selected={option.id === selected}
			disabled={locked}
			onSelect={(): void => setSelected(option.id)}
		/>)}</View>
		<ActionBanner
			icon={Flag}
			label={i18n.t(selected === null ? "commands:petExpedition.selectPlaceholder" : "app:expedition.start")}
			pending={locked}
			disabled={chosenIndex < 0}
			onPress={(): void => onChoose(chosenIndex)}
		/>
		<ButtonRow><Button disabled={locked} onPress={(): void => onChoose(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL))}>{i18n.t("commands:petExpedition.cancelButton")}</Button></ButtonRow>
	</>;
}

function ExpeditionOptions({collector, data, locked, onChoose, unfolding}: MenuProps): ReactNode {
	if (data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <RecallChoices collector={collector} locked={locked} onChoose={onChoose} unfolding={unfolding} />;
	if (data.type !== EXPEDITION_DATA_KINDS.CHOICE) return <CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />;
	return <DestinationChoices collector={collector} data={data.data} locked={locked} onChoose={onChoose} />;
}

function ExpeditionMenu({secondsLeft, ...props}: MenuProps & {secondsLeft: number}): ReactNode {
	return <Screen>
		<Standing
			emblem={props.data.type === EXPEDITION_DATA_KINDS.CHOICE
				? <ImpatientPet emoji={expeditionPetIcon(props.data.data.pet)} size={PET_EMBLEM_SIZE} />
				: <TwemojiIcon emoji={expeditionPetIcon(props.data.data.pet)} size={PET_EMBLEM_SIZE} />}
			caption={i18n.t("app:pet.eyebrow")}
			title={i18n.t(`app:expedition.titles.${props.data.type}`)}
			subtitle={menuSubtitle(props.data)}
		/>
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
	return <SheetModal visible onRequestClose={close}>
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
	</SheetModal>;
}
