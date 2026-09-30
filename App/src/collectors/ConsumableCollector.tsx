import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS, DRINK_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {countdownLabel, useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {itemDisplayName, itemIconPath} from "@/src/collectors/CollectorLabels";
import {consumableDescription} from "@/src/display/ItemEffects";
import {Clock3, Droplets, Gift} from "@/src/design/FightIcons";
import {Note} from "@/src/design/Primitives";
import {ActionBanner, ENTRY_CHEVRONS, ExpandableEntry, ExpandableList, QuestionSheet} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const CONSUMABLE_EMBLEM_SIZE = 26;

type ConsumableCollectorProps = {collector: ReactionCollectorCreation; onChoose: (index: number) => void; submitting: boolean};
/** The position in the collector is the answer, so every option carries the index it was sent at. */
type ConsumableOption = {index: number; item: ItemWithDetails};

function consumableOptions(collector: ReactionCollectorCreation): ConsumableOption[] {
	return collector.reactions.flatMap((reaction, index) => {
		if (reaction.type === DRINK_REACTION_KINDS.POTION) return [{index, item: reaction.data.potion}];
		if (reaction.type === DAILY_BONUS_REACTION_KINDS.OBJECT) return [{index, item: reaction.data.object}];
		return [];
	});
}

function ConsumableEmblem({item}: {item: ItemWithDetails}): ReactNode {
	const path = itemIconPath(item);
	const icon = path ? AppIcons.getIconOrNull(path) : null;
	return icon ? <TwemojiIcon emoji={icon} size={CONSUMABLE_EMBLEM_SIZE} /> : null;
}

/** A tap picks a consumable, the single button below uses it; a lone one is picked already. */
function ConsumableList({options, selected, onSelect}: {options: ConsumableOption[]; selected: number | undefined; onSelect: (index: number) => void}): ReactNode {
	return <ExpandableList>{options.map(option => <ExpandableEntry
		key={option.index}
		emblem={<ConsumableEmblem item={option.item} />}
		label={itemDisplayName(option.item)}
		caption={consumableDescription(option.item)}
		expanded={selected === option.index}
		highlighted={selected === option.index}
		chevron={ENTRY_CHEVRONS.NONE}
		onToggle={(): void => onSelect(option.index)}
	/>)}</ExpandableList>;
}

function ConsumableMenu({collector, onChoose, submitting, onClose}: ConsumableCollectorProps & {onClose: () => void}): ReactNode {
	const [answered, setAnswered] = useState(false);
	const options = consumableOptions(collector);
	const [selected, setSelected] = useState(options.length === 1 ? options[0].index : undefined);
	const secondsLeft = useSecondsLeft(collector.endTime);
	const dailyBonus = collector.data.type === DAILY_BONUS_DATA_KINDS.COLLECTOR;
	const pending = submitting || answered;
	const lock = secondsLeft === 0 ? {lock: {reason: i18n.t("app:collector.expired"), icon: Clock3}} : {};
	return <QuestionSheet
		caption={i18n.t("app:equipment.eyebrow")}
		title={i18n.t(dailyBonus ? "app:dailyBonus.title" : "app:inventoryActions.drinkTitle")}
		onClose={onClose}
	>
		<ConsumableList options={options} selected={selected} onSelect={setSelected} />
		<ActionBanner
			icon={dailyBonus ? Gift : Droplets}
			label={i18n.t(dailyBonus ? "app:dailyBonus.claim" : "app:collector.choices.drinkPotion")}
			pending={pending}
			disabled={selected === undefined}
			onPress={(): void => {
				if (selected === undefined) return;
				setAnswered(true);
				onChoose(selected);
			}}
			{...lock}
		/>
		<Note>{countdownLabel(secondsLeft, pending)}</Note>
	</QuestionSheet>;
}

export function ConsumableCollector(props: ConsumableCollectorProps): ReactNode {
	const refuseIndex = props.collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const close = (): void => {
		if (props.submitting) return;
		if (refuseIndex >= 0) props.onChoose(refuseIndex);
	};
	return <ConsumableMenu {...props} onClose={close} />;
}
