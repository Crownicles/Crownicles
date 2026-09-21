import {ReactNode, useState} from "react";
import {Modal} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS, DRINK_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {countdownLabel, useSecondsLeft} from "@/src/collectors/CollectorPrompt";
import {itemDisplayName, itemIconPath} from "@/src/collectors/CollectorLabels";
import {consumableDescription} from "@/src/display/ItemEffects";
import {Clock3, Droplets, Gift} from "@/src/design/FightIcons";
import {Hero, Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, ExpandableEntry, ExpandableList, ModalSurface} from "@/src/design/Sections";
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

function ConsumableMenu({collector, onChoose, submitting, onClose}: ConsumableCollectorProps & {onClose: () => void}): ReactNode {
	const options = consumableOptions(collector);
	const [expanded, setExpanded] = useState<number | undefined>(options[0]?.index);
	const [answered, setAnswered] = useState(false);
	const secondsLeft = useSecondsLeft(collector.endTime);
	const dailyBonus = collector.data.type === DAILY_BONUS_DATA_KINDS.COLLECTOR;
	const pending = submitting || answered;
	const choose = (index: number): void => {
		setAnswered(true);
		onChoose(index);
	};
	return <Screen>
		<BackButton label={i18n.t("app:common.back")} onClose={onClose} />
		<Hero eyebrow={i18n.t("app:equipment.eyebrow")} title={i18n.t(dailyBonus ? "app:dailyBonus.title" : "app:inventoryActions.drinkTitle")} />
		<ExpandableList>{options.map(option => <ExpandableEntry
			key={option.index}
			emblem={<ConsumableEmblem item={option.item} />}
			label={itemDisplayName(option.item)}
			caption={consumableDescription(option.item)}
			expanded={expanded === option.index}
			onToggle={(): void => setExpanded(previous => previous === option.index ? undefined : option.index)}
		>
			<ActionBanner
				icon={dailyBonus ? Gift : Droplets}
				label={i18n.t(dailyBonus ? "app:dailyBonus.claim" : "app:collector.choices.drinkPotion")}
				pending={pending}
				onPress={(): void => choose(option.index)}
				{...secondsLeft === 0 ? {lock: {reason: i18n.t("app:collector.expired"), icon: Clock3}} : {}}
			/>
		</ExpandableEntry>)}</ExpandableList>
		<Note>{countdownLabel(secondsLeft, pending)}</Note>
	</Screen>;
}

export function ConsumableCollector(props: ConsumableCollectorProps): ReactNode {
	const refuseIndex = props.collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
	const close = (): void => {
		if (props.submitting) return;
		if (refuseIndex >= 0) props.onChoose(refuseIndex);
	};
	return <Modal visible animationType="slide" onRequestClose={close}>
		<ModalSurface><ConsumableMenu {...props} onClose={close} /></ModalSurface>
	</Modal>;
}
