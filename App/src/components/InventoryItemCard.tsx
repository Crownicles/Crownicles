import {ReactNode, useState} from "react";
import {Text, View} from "react-native";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {inventoryItemEmblem, isMainItem, statValue} from "@/src/components/InventoryItemRow";
import {UnitIcon} from "@/src/components/UnitIcon";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
import {formatNumber} from "@/src/display/Amounts";
import {consumableDescription, effectAmount, natureUnit} from "@/src/display/ItemEffects";
import {joinFacts} from "@/src/display/Facts";
import {ArrowRight, Coins, Droplets, Gift, LucideIcon, Swords, X} from "@/src/design/FightIcons";
import {Button, ButtonRow, CountBadge, Note} from "@/src/design/Primitives";
import {ActionBanner, ExpandableEntry, LockHint, useSectionStyles} from "@/src/design/Sections";
import {ItemDetails} from "@/src/components/ItemDetails";
import {ExpandedEntry} from "@/src/design/useExpandedEntry";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";
import {
	InventoryItem, InventoryItemActions, ITEM_ACTIONS, ItemAction, ItemActionChoice
} from "@/src/store/useInventoryItemActions";
import {i18n} from "@/src/translations/i18n";

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

function ItemHeadline({entry, badge}: {entry: InventoryItem; badge: number}): ReactNode {
	const sectionStyles = useSectionStyles();
	const value = headline(entry);
	if (!value) return null;
	return <View style={sectionStyles.value}>
		<Text style={sectionStyles.amount} numberOfLines={1}>{value.value}</Text>
		<UnitIcon unit={value.unit} size={HEADLINE_UNIT_SIZE} />
		<CountBadge count={badge} />
	</View>;
}

/** Multi-use potions tell on the closed row how many sips they have left. */
function itemDetails(item: ItemWithDetails): string | null {
	if (isMainItem(item)) return i18n.t("app:inventory.level", {level: item.itemLevel});
	if (!item.maxUsages || item.maxUsages <= 1) return null;
	return i18n.t("app:inventory.usages", {usages: item.usages ?? item.maxUsages, max: item.maxUsages});
}

/** Effects and remaining uses stay readable even while the item is folded. */
function itemSummary(item: ItemWithDetails): string {
	const rarity = i18n.t(`items:rarities.${item.rarity}`);
	const details = joinFacts([itemDetails(item), isMainItem(item) ? null : consumableDescription(item)]);
	return details ? i18n.t("app:inventory.itemSummary", {rarity, details}) : rarity;
}

/** What the item is, and on the closed row already, why one of its actions is refused; a full reserve only shows once unfolded. */
function ItemCaption({item, choices, expanded}: {item: ItemWithDetails; choices: ItemActionChoice[]; expanded: boolean}): ReactNode {
	const sectionStyles = useSectionStyles();
	const lock = expanded ? undefined : choices.find(choice => choice.lock && choice.action !== ITEM_ACTIONS.DEPOSIT)?.lock;
	return <>
		<TwemojiText textStyle={sectionStyles.caption} emojiSize={Theme.fontSize.rowSubtitle}>{itemSummary(item)}</TwemojiText>
		{lock ? <LockHint lock={lock} /> : null}
	</>;
}

function actionLabel(action: ItemAction, confirming: boolean): string {
	return i18n.t(confirming ? "app:inventory.actions.confirm" : `app:inventory.actions.${action}`);
}

type ActionPress = {confirming: ItemAction | null; pending: boolean; press: (action: ItemAction) => void};

function MainItemAction({choice, pending, press, badge}: {choice: ItemActionChoice; pending: boolean; press: (action: ItemAction) => void; badge: number}): ReactNode {
	return <ActionBanner
		icon={ACTION_ICONS[choice.action]}
		label={actionLabel(choice.action, false)}
		pending={pending}
		badge={badge}
		{...choice.lock ? {lock: choice.lock} : {}}
		onPress={(): void => press(choice.action)}
	/>;
}

function OtherItemAction({choice, state}: {choice: ItemActionChoice; state: ActionPress}): ReactNode {
	const confirming = state.confirming === choice.action;
	return <Button
		icon={ACTION_ICONS[choice.action]}
		variant={confirming ? "danger" : "secondary"}
		disabled={state.pending || Boolean(choice.lock)}
		onPress={(): void => state.press(choice.action)}
	>{actionLabel(choice.action, confirming)}</Button>;
}

function OtherItemActions({choices, state}: {choices: ItemActionChoice[]; state: ActionPress}): ReactNode {
	const confirmation = state.confirming ? CONFIRMATIONS[state.confirming] : undefined;
	return <>
		{choices.length > 0 ? <ButtonRow>{choices.map(choice => <OtherItemAction key={choice.action} choice={choice} state={state} />)}</ButtonRow> : null}
		{confirmation ? <Note>{i18n.t(confirmation)}</Note> : null}
		{choices.flatMap(choice => choice.lock ? [<LockHint key={choice.action} lock={choice.lock} />] : [])}
	</>;
}

/** The most likely action as the dark bar, the others as buttons under it; parting with the item asks twice. */
function ItemActions({entry, choices, actions, onDone, badge}: {
	entry: InventoryItem;
	choices: ItemActionChoice[];
	actions: InventoryItemActions;
	onDone: () => void;
	badge: number;
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
	return <>
		{main ? <MainItemAction choice={main} pending={actions.pending} press={press} badge={badge} /> : null}
		<OtherItemActions choices={main ? choices.slice(1) : choices} state={{confirming, pending: actions.pending, press}} />
	</>;
}

/** An item of the inventory, which unfolds to show what it is worth and what can be done with it. */
export function InventoryItemCard({entry, choices, actions, unfolding, badge = 0}: {
	entry: InventoryItem;
	choices: ItemActionChoice[];
	actions: InventoryItemActions;
	unfolding: ExpandedEntry<string>;
	badge?: number;
}): ReactNode {
	const key = inventoryItemKey(entry);
	const expanded = unfolding.isExpanded(key);
	return <ExpandableEntry
		emblem={inventoryItemEmblem(entry.item)}
		label={itemDisplayName(entry.item)}
		caption={<ItemCaption item={entry.item} choices={choices} expanded={expanded} />}
		end={<ItemHeadline entry={entry} badge={badge} />}
		expanded={expanded}
		onToggle={(): void => unfolding.toggle(key)}
		testID={`inventory-item-${key}`}
	>
		<ItemDetails item={entry.item} />
		{choices.length > 0 ? <ItemActions entry={entry} choices={choices} actions={actions} onDone={unfolding.collapse} badge={badge} /> : null}
	</ExpandableEntry>;
}
