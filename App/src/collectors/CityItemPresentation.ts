import {
	CITY_REACTION_KINDS, CityMobileEnchantedItem, CityMobileEnchantmentTransfer, CityMobileEnchantmentTransferTarget, CityMobileItem, CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { i18n } from "@/src/translations/i18n";

export function cityItemName(item: {
	itemId: number; itemCategory: number;
}): string {
	const itemType = [
		"weapon",
		"armor",
		"potion",
		"object"
	][item.itemCategory] ?? "object";
	return i18n.t(`models:${itemType}s.${item.itemId}`);
}

type CityItemList = (snapshot: CityMobileSnapshot) => CityMobileItem[] | undefined;

/** Every list of the city a reaction may point an item in, searched in this order. */
const CITY_ITEM_LISTS: CityItemList[] = [
	(snapshot): CityMobileItem[] | undefined => snapshot.enchanter?.enchantableItems,
	(snapshot): CityMobileItem[] | undefined => snapshot.enchanter?.disenchantableItems,
	(snapshot): CityMobileItem[] | undefined => snapshot.home?.owned?.upgradeStation?.upgradeableItems,
	(snapshot): CityMobileItem[] | undefined => snapshot.blacksmith?.upgradeableItems,
	(snapshot): CityMobileItem[] | undefined => snapshot.blacksmith?.enchantmentTransfers,
	(snapshot): CityMobileItem[] | undefined => snapshot.scrapDealer?.recyclableItems,
	(snapshot): CityMobileItem[] | undefined => snapshot.royalBlacksmith?.upgradeableItems
];

function itemCandidates(snapshot: CityMobileSnapshot): CityMobileItem[] {
	return CITY_ITEM_LISTS.flatMap(list => list(snapshot) ?? []);
}

export function itemSnapshotForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	if (!snapshot) {
		return undefined;
	}
	const data = reaction.data as {
		slot?: number; sourceSlot?: number; itemCategory?: number;
	};

	// An enchantment transfer is told by the equipment it takes the enchantment from.
	const slot = data.slot ?? data.sourceSlot;
	if (data.itemCategory === undefined || slot === undefined) {
		return undefined;
	}
	return itemCandidates(snapshot).find(item => item.itemCategory === data.itemCategory && item.itemId !== undefined && item.slot === slot);
}

export type EnchantmentTransferChoice = {
	source: CityMobileEnchantmentTransfer; target: CityMobileEnchantmentTransferTarget;
};

/** The enchanted equipment and the bare one an enchantment transfer reaction moves it onto. */
export function enchantmentTransferForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): EnchantmentTransferChoice | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER) {
		return undefined;
	}
	const {
		itemCategory, sourceSlot, targetSlot
	} = reaction.data;
	const source = snapshot?.blacksmith?.enchantmentTransfers.find(candidate => candidate.itemCategory === itemCategory && candidate.slot === sourceSlot);
	const target = source?.targets.find(candidate => candidate.slot === targetSlot);
	return source && target
		? {
			source, target
		}
		: undefined;
}

/** The enchantment a city service takes off the item: Mernil removes it for free, the blacksmith moves it onto another equipment. */
export function enchantedItemForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileEnchantedItem | undefined {
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER) {
		return enchantmentTransferForReaction(snapshot, reaction)?.source;
	}
	const item = itemSnapshotForReaction(snapshot, reaction);
	return item ? snapshot?.enchanter?.disenchantableItems?.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory) : undefined;
}

export function cityItemIconPath(item: Pick<CityMobileItem, "itemId" | "itemCategory">): string {
	const itemType = [
		"weapons",
		"armors",
		"potions",
		"objects"
	][item.itemCategory] ?? "objects";
	return `${itemType}.${item.itemId}`;
}
