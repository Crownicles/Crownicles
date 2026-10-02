import {ReactNode, useState} from "react";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {inventoryItemDetails, inventoryItemEmblem} from "@/src/components/InventoryItemRow";
import {itemDisplayName} from "@/src/collectors/CollectorLabels";
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

/** What the item is, and on the closed row already, why one of its actions is refused; a full reserve only shows once unfolded. */
function ItemCaption({item, choices, expanded}: {item: ItemWithDetails; choices: ItemActionChoice[]; expanded: boolean}): ReactNode {
	const sectionStyles = useSectionStyles();
	const lock = expanded ? undefined : choices.find(choice => choice.lock && choice.action !== ITEM_ACTIONS.DEPOSIT)?.lock;
	return <>
		<TwemojiText textStyle={sectionStyles.caption} emojiSize={Theme.fontSize.rowSubtitle}>{inventoryItemDetails(item)}</TwemojiText>
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
		end={badge > 0 ? <CountBadge count={badge} /> : undefined}
		expanded={expanded}
		onToggle={(): void => unfolding.toggle(key)}
		testID={`inventory-item-${key}`}
	>
		<ItemDetails item={entry.item} />
		{choices.length > 0 ? <ItemActions entry={entry} choices={choices} actions={actions} onDone={unfolding.collapse} badge={badge} /> : null}
	</ExpandableEntry>;
}
