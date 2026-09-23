import {EquipActionReq} from "ws-packets/src/fromClient/EquipActionReq";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {DAILY_BONUS_REACTION_KINDS, DRINK_REACTION_KINDS, ReactionCollectorReaction, SELL_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {EQUIP_ACTIONS, EQUIP_ERRORS, EquipAction} from "ws-packets/src/objects/EquipCategoryData";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {CommandMenu, INVENTORY_MENUS, useCommandMenus} from "@/src/store/useInventoryMenus";
import {useEquipmentActions} from "@/src/store/useEquipmentActions";
import type {Lock} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

export const ITEM_ACTIONS = {
	EQUIP: "equip",
	DEPOSIT: "deposit",
	DRINK: "drink",
	DAILY: "daily",
	SELL: "sell",
	DISCARD: "discard"
} as const;
export type ItemAction = typeof ITEM_ACTIONS[keyof typeof ITEM_ACTIONS];

export type ItemKind = "weapon" | "armor" | "potion" | "object";

/** The slot the worn item of a category sits in. */
export const EQUIPPED_SLOT = 0;

/** An item where the inventory shows it: worn, or kept in a numbered reserve slot. */
export type InventoryItem = {item: ItemWithDetails; kind: ItemKind; slot: number; equipped: boolean};

/** What the rest of the inventory decides about an item: whether it can be put away, whether the daily bonus is ready. */
export type ItemActionContext = {reserveFull: boolean; dailyLock: Lock | undefined; equippedObjectGivesDaily: boolean};

export type ItemActionChoice = {action: ItemAction; lock?: Lock};

type EquipmentAction = typeof ITEM_ACTIONS.EQUIP | typeof ITEM_ACTIONS.DEPOSIT;
type MenuAction = Exclude<ItemAction, EquipmentAction>;
type ReactionMatcher = (reaction: ReactionCollectorReaction, entry: InventoryItem) => boolean;

/** Natures only a fight can use: such a potion cannot be drunk and such an object gives no daily bonus. */
const FIGHT_NATURES: ReadonlySet<ItemNature> = new Set([ItemNature.ATTACK, ItemNature.DEFENSE, ItemNature.SPEED]);

function isSupportItem(item: ItemWithDetails): item is SupportItem {
	return "nature" in item;
}

function isDrinkable(item: ItemWithDetails): boolean {
	return isSupportItem(item) && !FIGHT_NATURES.has(item.nature);
}

export function givesDailyBonus(item: ItemWithDetails): boolean {
	return isSupportItem(item) && item.nature !== ItemNature.NONE && !FIGHT_NATURES.has(item.nature);
}

/** Potions are never bought back: selling one only throws it away. */
function saleAction(entry: InventoryItem): ItemActionChoice {
	return {action: entry.kind === "potion" ? ITEM_ACTIONS.DISCARD : ITEM_ACTIONS.SELL};
}

function consumeAction(entry: InventoryItem, context: ItemActionContext): ItemActionChoice[] {
	if (entry.kind === "potion") return isDrinkable(entry.item) ? [{action: ITEM_ACTIONS.DRINK}] : [];
	if (entry.kind !== "object" || !givesDailyBonus(entry.item)) return [];

	// The server always spends the worn object first, so a reserve one is only offered when the worn one cannot.
	if (!entry.equipped && context.equippedObjectGivesDaily) return [];
	return [{action: ITEM_ACTIONS.DAILY, ...context.dailyLock ? {lock: context.dailyLock} : {}}];
}

/** What can be done with an item from where it lies, the most likely action first. */
export function itemActions(entry: InventoryItem, context: ItemActionContext): ItemActionChoice[] {
	if (entry.item.id === 0) return [];
	if (entry.equipped) {
		const deposit: ItemActionChoice = {
			action: ITEM_ACTIONS.DEPOSIT,
			...context.reserveFull ? {lock: {reason: i18n.t(`app:equipment.errors.${EQUIP_ERRORS.RESERVE_FULL}`)}} : {}
		};
		return [...consumeAction(entry, context), deposit];
	}
	return [...consumeAction(entry, context), {action: ITEM_ACTIONS.EQUIP}, saleAction(entry)];
}

const sellsThisItem: ReactionMatcher = (reaction, entry) => reaction.type === SELL_REACTION_KINDS.ITEM
	&& reaction.data.slot === entry.slot
	&& reaction.data.item.category === entry.item.itemCategory;

/** How to recognise, in the menu the server opens, the reaction aimed at the tapped item. */
const REACTION_MATCHERS: Record<MenuAction, ReactionMatcher> = {
	[ITEM_ACTIONS.DRINK]: (reaction, entry) => reaction.type === DRINK_REACTION_KINDS.POTION && reaction.data.potion.id === entry.item.id,
	[ITEM_ACTIONS.DAILY]: (reaction, entry) => reaction.type === DAILY_BONUS_REACTION_KINDS.OBJECT && reaction.data.object.id === entry.item.id,
	[ITEM_ACTIONS.SELL]: sellsThisItem,
	[ITEM_ACTIONS.DISCARD]: sellsThisItem
};

/** The reaction that carries out the action on this very item, or nothing to let the player pick it themselves. */
function reactionFor(action: MenuAction, entry: InventoryItem, collector: ReactionCollectorCreation): number | null {
	const index = collector.reactions.findIndex(reaction => REACTION_MATCHERS[action](reaction, entry));
	return index < 0 ? null : index;
}

const ACTION_MENUS: Record<MenuAction, CommandMenu> = {
	[ITEM_ACTIONS.DRINK]: INVENTORY_MENUS.DRINK,
	[ITEM_ACTIONS.DAILY]: INVENTORY_MENUS.DAILY,
	[ITEM_ACTIONS.SELL]: INVENTORY_MENUS.SELL,
	[ITEM_ACTIONS.DISCARD]: INVENTORY_MENUS.SELL
};

const EQUIPMENT_ACTIONS: Record<EquipmentAction, EquipAction> = {
	[ITEM_ACTIONS.EQUIP]: EQUIP_ACTIONS.EQUIP,
	[ITEM_ACTIONS.DEPOSIT]: EQUIP_ACTIONS.DEPOSIT
};

export type InventoryItemActions = {
	pending: boolean;
	message: string | null;
	run: (action: ItemAction, entry: InventoryItem) => Promise<void>;
};

/** Carries out an action on the item the player tapped, without making them pick it a second time. */
export function useInventoryItemActions(): InventoryItemActions {
	const menus = useCommandMenus();
	const equipment = useEquipmentActions([]);
	const run = (action: ItemAction, entry: InventoryItem): Promise<void> => {
		if (action === ITEM_ACTIONS.EQUIP || action === ITEM_ACTIONS.DEPOSIT) {
			return equipment.submit(makeFromClientPacket(EquipActionReq, {
				action: EQUIPMENT_ACTIONS[action],
				itemCategory: entry.item.itemCategory,
				slot: entry.slot
			}));
		}
		return menus.open(ACTION_MENUS[action], undefined, collector => reactionFor(action, entry, collector));
	};
	return {
		pending: menus.pending || equipment.pending,
		message: menus.message ?? (equipment.error ? i18n.t(equipment.error) : null),
		run
	};
}
