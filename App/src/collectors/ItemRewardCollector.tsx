import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, ITEM_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {AppIcons} from "@/src/AppIcons";
import {isPotionCategory, itemDisplayName, itemIconPath} from "@/src/collectors/CollectorLabels";
import {EventJournal, usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {useChooseOnce} from "@/src/collectors/ShopCollector";
import {inventoryItemDetails, inventoryItemEmblem, InventoryItemRow} from "@/src/components/InventoryItemRow";
import {plainStory} from "@/src/display/Markdown";
import {Button, ButtonRow, Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Card, ExpandableEntry} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";
import {i18n} from "@/src/translations/i18n";

type ItemRewardProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

function reactionIndex(collector: ReactionCollectorCreation, type: string): number {
	return collector.reactions.findIndex(reaction => reaction.type === type);
}

/** Discord posts the find on its own before asking anything: the item, with the stats it comes with. */
function FoundItemJournal({item}: {item: ItemWithDetails}): ReactNode {
	const pseudo = usePlayerPseudo();
	const path = itemIconPath(item);
	return <EventJournal
		emoji={path ? AppIcons.getIconOrNull(path) ?? undefined : undefined}
		title={plainStory(i18n.t("commands:inventory.randomItemTitle", {pseudo}))}
		story={`**${itemDisplayName(item)}**\n${inventoryItemDetails(item)}`}
	/>;
}

/** Drinking the find on the spot, or leaving it: the two ways out that do not touch the inventory. */
function FoundItemExits({collector, foundItem, drinkType, refuseType, choose, locked}: {
	collector: ReactionCollectorCreation;
	foundItem: ItemWithDetails;
	drinkType: string;
	refuseType: string;
	choose: (index: number) => void;
	locked: boolean;
}): ReactNode {
	const drinkIndex = reactionIndex(collector, drinkType);
	const refuseIndex = reactionIndex(collector, refuseType);
	const isPotion = isPotionCategory(foundItem.itemCategory);
	return <ButtonRow>
		{drinkIndex >= 0 ? <Button
			emoji={AppIcons.getIcon("items.drinkPotion")}
			disabled={locked}
			onPress={(): void => choose(drinkIndex)}
		>{i18n.t("app:collector.choices.drinkPotion")}</Button> : null}
		{refuseIndex >= 0 ? <Button
			emoji={AppIcons.getIcon(isPotion ? "collectors.refuse" : "unitValues.money")}
			disabled={locked}
			onPress={(): void => choose(refuseIndex)}
		>
			{i18n.t(isPotion ? "app:collector.item.throwFound" : "app:collector.item.sellFound")}
		</Button> : null}
	</ButtonRow>;
}

/** The inventory is full: every item of the same kind is listed, and the one given away is confirmed in place. */
export function ItemChoiceCollector({collector, onChoose, submitting}: ItemRewardProps): ReactNode {
	const [openIndex, setOpenIndex] = useState<number>();
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	if (collector.data.type !== ITEM_DATA_KINDS.CHOICE) {
		return null;
	}
	const {foundItem} = collector.data.data;
	const found = itemDisplayName(foundItem);

	return (
		<Screen>
			<FoundItemJournal item={foundItem} />
			<SectionHeader>{i18n.t("commands:inventory.chooseItemToReplaceTitle")}</SectionHeader>
			<Card>{collector.reactions.map((reaction, index) => {
				if (reaction.type !== ITEM_REACTION_KINDS.CHOICE_ITEM) return null;
				const item = reaction.data.itemWithDetails;
				return <ExpandableEntry
					key={reaction.data.slot}
					emblem={inventoryItemEmblem(item)}
					label={itemDisplayName(item)}
					caption={inventoryItemDetails(item)}
					dimmed={locked}
					expanded={openIndex === index}
					onToggle={(): void => setOpenIndex(openIndex === index ? undefined : index)}
				>
					<ActionBanner
						icon={Check}
						label={i18n.t("app:collector.item.replaceWith", {item: found})}
						pending={locked}
						onPress={(): void => choose(index)}
					/>
				</ExpandableEntry>;
			})}</Card>
			<FoundItemExits
				collector={collector}
				foundItem={foundItem}
				drinkType={ITEM_REACTION_KINDS.CHOICE_DRINK_POTION}
				refuseType={ITEM_REACTION_KINDS.CHOICE_REFUSE}
				choose={choose}
				locked={locked}
			/>
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}

/** A single slot of that kind: Discord asks whether the item already held should make room for the find. */
export function ItemAcceptCollector({collector, onChoose, submitting}: ItemRewardProps): ReactNode {
	const {locked, choose} = useChooseOnce(onChoose, submitting);
	if (collector.data.type !== ITEM_DATA_KINDS.ACCEPT) {
		return null;
	}
	const {foundItem, itemWithDetails} = collector.data.data;
	const acceptIndex = reactionIndex(collector, GENERIC_REACTION_KINDS.ACCEPT);

	return (
		<Screen>
			<FoundItemJournal item={foundItem} />
			<SectionHeader>{i18n.t(isPotionCategory(foundItem.itemCategory)
				? "commands:inventory.randomItemAcceptTitlePotion"
				: "commands:inventory.randomItemAcceptTitle")}</SectionHeader>
			<Card><InventoryItemRow item={itemWithDetails} /></Card>
			{acceptIndex >= 0 ? <ActionBanner
				icon={Check}
				label={i18n.t("app:collector.item.replaceWith", {item: itemDisplayName(foundItem)})}
				pending={locked}
				onPress={(): void => choose(acceptIndex)}
			/> : null}
			<FoundItemExits
				collector={collector}
				foundItem={foundItem}
				drinkType={ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION}
				refuseType={GENERIC_REACTION_KINDS.REFUSE}
				choose={choose}
				locked={locked}
			/>
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
