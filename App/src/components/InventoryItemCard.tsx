import {ReactNode, useState} from "react";
import {Text, View} from "react-native";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {inventoryItemEmblem, isMainItem, statValue} from "@/src/components/InventoryItemRow";
import {UnitIcon} from "@/src/components/UnitIcon";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {formatNumber} from "@/src/display/Amounts";
import {consumableDescription, effectAmount, natureUnit} from "@/src/display/ItemEffects";
import {ArrowRight, Coins, Droplets, Gift, LucideIcon, Swords, X} from "@/src/design/FightIcons";
import {Button, ButtonRow, Note} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, Fact, Figures, LockHint, sectionStyles} from "@/src/design/Sections";
import {ExpandedEntry} from "@/src/design/useExpandedEntry";
import {
	InventoryItem, InventoryItemActions, ITEM_ACTIONS, ItemAction, ItemActionChoice
} from "@/src/store/useInventoryItemActions";
import {i18n} from "@/src/translations/i18n";

const MAIN_STATS = ["attack", "defense", "speed"] as const;
const HEADLINE_UNIT_SIZE = 12;

const ACTION_ICONS: Record<ItemAction, LucideIcon> = {
	[ITEM_ACTIONS.EQUIP]: Swords,
	[ITEM_ACTIONS.DEPOSIT]: ArrowRight,
	[ITEM_ACTIONS.DRINK]: Droplets,
	[ITEM_ACTIONS.DAILY]: Gift,
	[ITEM_ACTIONS.SELL]: Coins,
	[ITEM_ACTIONS.DISCARD]: X
};

/** Parting with an item cannot be undone, so it takes a second tap on the same button, which says so. */
const CONFIRMATIONS: Partial<Record<ItemAction, string>> = {
	[ITEM_ACTIONS.SELL]: "app:sale.confirmSell",
	[ITEM_ACTIONS.DISCARD]: "app:sale.confirmDiscard"
};

function isIrreversible(action: ItemAction): boolean {
	return action in CONFIRMATIONS;
}

export function inventoryItemKey(entry: InventoryItem): string {
	return `${entry.kind}-${entry.slot}`;
}

/** The one number the item is worn for, so rows compare at a glance without unfolding. */
function headline({item, kind}: InventoryItem): {value: string; unit: string} | null {
	if (isMainItem(item)) {
		const stat = kind === "armor" ? "defense" : "attack";
		return {value: formatNumber(statValue(item[stat])), unit: stat};
	}
	const unit = natureUnit(item.nature);
	if (!unit) return null;
	return {value: effectAmount(item.nature, item.power), unit};
}

function ItemHeadline({entry}: {entry: InventoryItem}): ReactNode {
	const value = headline(entry);
	if (!value) return null;
	return <View style={sectionStyles.value}>
		<Text style={sectionStyles.amount} numberOfLines={1}>{value.value}</Text>
		<UnitIcon unit={value.unit} size={HEADLINE_UNIT_SIZE} />
	</View>;
}

function ItemStats({item}: {item: ItemWithDetails}): ReactNode {
	if (!isMainItem(item)) return <Fact label={i18n.t("app:equipment.stats.effect")} value={consumableDescription(item)} />;
	return <>
		<Figures items={MAIN_STATS.map(stat => ({
			caption: i18n.t(`app:equipment.stats.${stat}`),
			value: formatNumber(statValue(item[stat])),
			unit: stat
		}))} />
		{item.itemEnchantmentId ? <Fact label={i18n.t("app:inventory.enchantment")} value={i18n.t(`items:enchantments.${item.itemEnchantmentId}`)} /> : null}
	</>;
}

/** A caption short enough to hold on one line: the numbers live at the end of the row and in the unfolded panel. */
function itemSummary(item: ItemWithDetails): string {
	const rarity = i18n.t(`items:raritiesWithoutEmote.${item.rarity}`);
	return isMainItem(item) ? i18n.t("app:inventory.itemSummary", {rarity, details: i18n.t("app:inventory.level", {level: item.itemLevel})}) : rarity;
}

/** What the item is, and on the closed row already, why one of its actions is refused. */
function ItemCaption({item, choices, expanded}: {item: ItemWithDetails; choices: ItemActionChoice[]; expanded: boolean}): ReactNode {
	const lock = expanded ? undefined : choices.find(choice => choice.lock)?.lock;
	return <>
		<Text style={sectionStyles.caption} numberOfLines={1}>{itemSummary(item)}</Text>
		{lock ? <LockHint lock={lock} /> : null}
	</>;
}

function actionLabel(action: ItemAction, confirming: boolean): string {
	return i18n.t(confirming ? "app:inventory.actions.confirm" : `app:inventory.actions.${action}`);
}

/** The most likely action as the dark bar, the others as buttons under it; parting with the item asks twice. */
function ItemActions({entry, choices, actions, onDone}: {
	entry: InventoryItem;
	choices: ItemActionChoice[];
	actions: InventoryItemActions;
	onDone: () => void;
}): ReactNode {
	const [confirming, setConfirming] = useState<ItemAction | null>(null);
	const press = (action: ItemAction): void => {
		if (isIrreversible(action) && confirming !== action) {
			setConfirming(action);
			return;
		}
		setConfirming(null);
		actions.run(action, entry).then(onDone).catch(console.error);
	};
	const main = isIrreversible(choices[0].action) ? undefined : choices[0];
	const others = main ? choices.slice(1) : choices;
	const confirmation = confirming ? CONFIRMATIONS[confirming] : undefined;
	return <>
		{main ? <ActionBanner
			icon={ACTION_ICONS[main.action]}
			label={actionLabel(main.action, false)}
			pending={actions.pending}
			{...main.lock ? {lock: main.lock} : {}}
			onPress={(): void => press(main.action)}
		/> : null}
		{others.length > 0 ? <ButtonRow>{others.map(choice => <Button
			key={choice.action}
			icon={ACTION_ICONS[choice.action]}
			variant={confirming === choice.action ? "danger" : "secondary"}
			disabled={actions.pending || Boolean(choice.lock)}
			onPress={(): void => press(choice.action)}
		>{actionLabel(choice.action, confirming === choice.action)}</Button>)}</ButtonRow> : null}
		{confirmation ? <Note>{i18n.t(confirmation)}</Note> : null}
		{others.flatMap(choice => choice.lock ? [<LockHint key={choice.action} lock={choice.lock} />] : [])}
	</>;
}

/** An item of the inventory, which unfolds to show what it is worth and what can be done with it. */
export function InventoryItemCard({entry, choices, actions, unfolding}: {
	entry: InventoryItem;
	choices: ItemActionChoice[];
	actions: InventoryItemActions;
	unfolding: ExpandedEntry<string>;
}): ReactNode {
	const key = inventoryItemKey(entry);
	const expanded = unfolding.isExpanded(key);
	return <ExpandableEntry
		emblem={inventoryItemEmblem(entry.item)}
		label={itemDisplayName(entry.item)}
		caption={<ItemCaption item={entry.item} choices={choices} expanded={expanded} />}
		end={<ItemHeadline entry={entry} />}
		expanded={expanded}
		onToggle={(): void => unfolding.toggle(key)}
		testID={`inventory-item-${key}`}
	>
		<ItemStats item={entry.item} />
		{choices.length > 0 ? <ItemActions entry={entry} choices={choices} actions={actions} onDone={unfolding.collapse} /> : null}
	</ExpandableEntry>;
}
