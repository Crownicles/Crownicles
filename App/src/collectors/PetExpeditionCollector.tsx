import {ReactNode, useState} from "react";
import {View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS, ReactionCollectorData} from "ws-packets/src/fromServer/collectors";
import {ExpeditionProgress} from "ws-packets/src/objects/PetExpedition";
import {Button, ButtonRow, Note, Screen} from "@/src/design/Primitives";
import {
	ActionBanner, BottomSheet, Effect, EFFECT_TONES, ExpandableList, Fact, FullScreen, JournalEntry, Standing
} from "@/src/design/Sections";
import {Check, Flag, PawPrint} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Story} from "@/src/design/Story";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {ExpeditionOptionRow} from "@/src/components/ExpeditionDetails";
import {ImpatientPet} from "@/src/components/PetReaction";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {useCollectorAnswer} from "@/src/collectors/useCollectorAnswer";
import {expeditionLocationName, expeditionPetIcon, expeditionPetName, expeditionRisk} from "@/src/display/PetExpedition";
import {formatNumber} from "@/src/display/Amounts";
import {missionDate} from "@/src/display/Missions";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const PET_EMBLEM_SIZE = 34;

const useStyles = createStyles(() => ({
	options: {gap: Theme.spacing.sm, marginBottom: Theme.spacing.lg},
	intro: {marginBottom: Theme.spacing.lg},
	actions: {gap: Theme.spacing.sm}
}));

type ExpeditionData = Extract<ReactionCollectorData, {type: typeof EXPEDITION_DATA_KINDS[keyof typeof EXPEDITION_DATA_KINDS]}>;
const EXPEDITION_KINDS = new Set<ReactionCollectorData["type"]>(Object.values(EXPEDITION_DATA_KINDS));
type MenuProps = {
	collector: ReactionCollectorCreation;
	data: ExpeditionData;
	locked: boolean;
	onChoose: (index: number) => void;
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
	return <ExpandableList>
		<Fact label={i18n.t("app:expedition.destination")} value={expeditionLocationName(data.data)} />
		<Fact label={i18n.t("app:expedition.risk")} value={expeditionRisk(data.data.riskCategory)} />
		{data.data.foodConsumed !== undefined ? <Fact label={i18n.t("app:expedition.foodConsumed")} value={formatNumber(data.data.foodConsumed)} /> : null}
	</ExpandableList>;
}

function neutral(label: string, value: string, emoji: string): Effect {
	return {label, value, tone: EFFECT_TONES.NEUTRAL, emoji};
}

/** What Discord lists under the trip, as the chips an event result wears. */
function progressEffects(data: ExpeditionProgress): Effect[] {
	return [
		neutral(i18n.t("app:expedition.risk"), i18n.t(`commands:petExpedition.riskCategories.${data.riskCategory}`), AppIcons.getIcon(`expedition.risk.${data.riskCategory}`)),
		neutral(i18n.t("app:expedition.returnAt"), missionDate(data.returnTime), AppIcons.getIcon("expedition.duration")),
		...data.foodConsumed ? [neutral(i18n.t("app:expedition.foodConsumed"), formatNumber(data.foodConsumed), AppIcons.getIcon("expedition.food"))] : []
	];
}

/**
 * The pet page follows the trip and recalls from its own button; this sheet only shows when Core asks
 * about the trip another way, told as an entry of the journal.
 */
function ExpeditionInProgress({collector, data, locked, onChoose}: {collector: ReactionCollectorCreation; data: ExpeditionProgress; locked: boolean; onChoose: (index: number) => void}): ReactNode {
	const styles = useStyles();
	const [confirming, setConfirming] = useState(false);
	const recallIndex = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.RECALL);
	const closeIndex = collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CLOSE);
	const petDisplay = `**${expeditionPetName(data.pet)}**`;
	return <>
		<JournalEntry
			plain
			emblem={<TwemojiIcon emoji={expeditionPetIcon(data.pet)} size={Theme.dimensions.headerIcon} />}
			title={i18n.t(`app:expedition.titles.${EXPEDITION_DATA_KINDS.PROGRESS}`)}
			effects={progressEffects(data)}
		>
			<Story>{i18n.t("commands:petExpedition.inProgressDescription.intro", {petDisplay})}</Story>
			<Story>{i18n.t("commands:petExpedition.inProgressDescription.destination", {location: expeditionLocationName(data)})}</Story>
		</JournalEntry>
		<View style={styles.actions}>
			{closeIndex >= 0 ? <ActionBanner icon={PawPrint} label={i18n.t("app:common.back")} pending={locked} onPress={(): void => onChoose(closeIndex)} /> : null}
			{confirming ? <>
				<Note>{i18n.t("app:expedition.recallWarning")}</Note>
				<ActionBanner icon={Check} label={i18n.t("app:expedition.confirmRecall")} pending={locked} onPress={(): void => onChoose(recallIndex)} />
			</> : null}
		</View>
		{recallIndex >= 0 ? <ButtonRow><Button
			emoji={AppIcons.getIcon("expedition.recall")}
			disabled={locked}
			onPress={(): void => setConfirming(!confirming)}
		>{i18n.t("app:expedition.recall")}</Button></ButtonRow> : null}
	</>;
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

function ExpeditionOptions({collector, data, locked, onChoose}: MenuProps): ReactNode {
	if (data.type !== EXPEDITION_DATA_KINDS.CHOICE) return <CollectorChoices collector={collector} onChoose={onChoose} submitting={locked} />;
	return <DestinationChoices collector={collector} data={data.data} locked={locked} onChoose={onChoose} />;
}

function ExpeditionMenu({secondsLeft, ...props}: MenuProps & {secondsLeft: number}): ReactNode {
	const timeLeft = props.data.type !== EXPEDITION_DATA_KINDS.FINISHED ? <Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note> : null;
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
		{timeLeft}
	</Screen>;
}

export function PetExpeditionCollector({collector, onChoose, submitting}: {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean}): ReactNode {
	const {answer, locked, secondsLeft} = useCollectorAnswer(collector, onChoose, submitting);
	const choose = (index: number): void => {
		if (locked || index < 0) return;
		answer(index);
	};
	const close = (): void => answer(collector.reactions.findIndex(reaction => reaction.type === EXPEDITION_REACTION_KINDS.CANCEL || reaction.type === EXPEDITION_REACTION_KINDS.CLOSE));
	if (!isExpeditionCollector(collector.data)) return null;
	if (collector.data.type === EXPEDITION_DATA_KINDS.PROGRESS) return <BottomSheet onClose={close}>
		<ExpeditionInProgress collector={collector} data={collector.data.data} locked={locked} onChoose={choose} />
		<Note>{i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}</Note>
	</BottomSheet>;
	return <FullScreen onClose={close}>
		<ExpeditionMenu
			collector={collector}
			data={collector.data}
			locked={locked}
			onChoose={choose}
			secondsLeft={secondsLeft}
		/>
	</FullScreen>;
}
