import {ReactNode, useState} from "react";
import {StyleSheet, View} from "react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, ITEM_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {isPotionCategory, itemDisplayName} from "@/src/collectors/CollectorLabels";
import {EventJournal, usePlayerPseudo} from "@/src/collectors/EventOutcomeScreen";
import {useChooseOnce} from "@/src/collectors/ShopCollector";
import {inventoryItemDetails, inventoryItemEmblem, InventoryItemRow, isMainItem, itemEmoji} from "@/src/components/InventoryItemRow";
import {ItemDetails} from "@/src/components/ItemDetails";
import {plainStory} from "@/src/display/Markdown";
import {Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, Card, ExpandableEntry} from "@/src/design/Sections";
import {Check, Coins, Droplets, X} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	banners: {gap: Theme.spacing.sm}
});

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
	return <EventJournal
		emoji={itemEmoji(item) ?? undefined}
		title={plainStory(i18n.t("commands:inventory.randomItemTitle", {pseudo}))}
		story={`**${itemDisplayName(item)}**\n${inventoryItemDetails(item)}`}
	/>;
}

/** The find's figures, each with what it wins or loses against the item it would replace. */
function FoundAgainst({found, current}: {found: ItemWithDetails; current: ItemWithDetails}): ReactNode {
	if (!isMainItem(found) || !isMainItem(current)) return null;
	return <>
		<Note>{i18n.t("app:collector.item.comparedTo", {found: itemDisplayName(found), item: itemDisplayName(current)})}</Note>
		<ItemDetails item={found} reference={current} />
	</>;
}

/** One way out, named and drawn by the item the player keeps, with what goes in exchange written under it before the press. */
function KeepChoice({kept, given, onPress, locked}: {kept: {label: string; item?: ItemWithDetails}; given: ItemWithDetails; onPress: () => void; locked: boolean}): ReactNode {
	const potion = isPotionCategory(given.itemCategory);
	const emoji = kept.item ? itemEmoji(kept.item) : null;
	return <ActionBanner
		icon={Check}
		{...emoji ? {emoji} : {}}
		label={kept.label}
		hint={{reason: i18n.t(potion ? "app:collector.item.thrown" : "app:collector.item.sold", {item: itemDisplayName(given)}), icon: potion ? X : Coins}}
		pending={locked}
		onPress={onPress}
	/>;
}

/** Drinking the find on the spot, or leaving it: the two ways out that do not touch the inventory. */
function FoundItemExits({collector, foundItem, keepCurrent, drinkType, refuseType, choose, locked, children}: {
	collector: ReactionCollectorCreation;
	foundItem: ItemWithDetails;

	/** The refusal, named by what the player keeps instead of the find. */
	keepCurrent: {label: string; item?: ItemWithDetails};
	drinkType: string;
	refuseType: string;
	choose: (index: number) => void;
	locked: boolean;

	/** The choice keeping the find, shown first. */
	children?: ReactNode;
}): ReactNode {
	const drinkIndex = reactionIndex(collector, drinkType);
	const refuseIndex = reactionIndex(collector, refuseType);
	return <View style={styles.banners}>
		{children}
		{refuseIndex >= 0 ? <KeepChoice
			kept={keepCurrent}
			given={foundItem}
			locked={locked}
			onPress={(): void => choose(refuseIndex)}
		/> : null}
		{drinkIndex >= 0 ? <ActionBanner
			icon={Droplets}
			label={i18n.t("app:collector.choices.drinkPotion")}
			pending={locked}
			onPress={(): void => choose(drinkIndex)}
		/> : null}
	</View>;
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
			<SectionHeader>{i18n.t("app:collector.item.chooseToSell", {item: found})}</SectionHeader>
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
					<FoundAgainst found={foundItem} current={item} />
					<KeepChoice
						kept={{label: i18n.t("app:collector.item.keep", {item: found}), item: foundItem}}
						given={item}
						locked={locked}
						onPress={(): void => choose(index)}
					/>
				</ExpandableEntry>;
			})}</Card>
			<FoundItemExits
				collector={collector}
				foundItem={foundItem}
				keepCurrent={{label: i18n.t("app:collector.item.keepAll")}}
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
			<SectionHeader>{i18n.t("app:collector.item.current")}</SectionHeader>
			<Card><InventoryItemRow item={itemWithDetails} /></Card>
			<FoundAgainst found={foundItem} current={itemWithDetails} />
			<SectionHeader>{i18n.t("app:collector.item.whichToKeep")}</SectionHeader>
			<FoundItemExits
				collector={collector}
				foundItem={foundItem}
				keepCurrent={{label: i18n.t("app:collector.item.keep", {item: itemDisplayName(itemWithDetails)}), item: itemWithDetails}}
				drinkType={ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION}
				refuseType={GENERIC_REACTION_KINDS.REFUSE}
				choose={choose}
				locked={locked}
			>
				{acceptIndex >= 0 ? <KeepChoice
					kept={{label: i18n.t("app:collector.item.keep", {item: itemDisplayName(foundItem)}), item: foundItem}}
					given={itemWithDetails}
					locked={locked}
					onPress={(): void => choose(acceptIndex)}
				/> : null}
			</FoundItemExits>
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
