import {
	CityMobileItem, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {i18n} from "@/src/translations/i18n";

export function cityItemName(item: {itemId: number; itemCategory: number}): string {
	const itemType = ["weapon", "armor", "potion", "object"][item.itemCategory] ?? "object";
	return i18n.t(`models:${itemType}s.${item.itemId}`);
}

// @codescene(disable:"Complex Method")
export function itemSnapshotForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	if (!snapshot) return undefined;
	const data = reaction.data as {slot?: number; itemCategory?: number};
	if (data.itemCategory === undefined || data.slot === undefined) return undefined;
	const candidates = [
		...(snapshot.enchanter?.enchantableItems ?? []),
		...(snapshot.blacksmith?.upgradeableItems ?? []),
		...(snapshot.blacksmith?.disenchantableItems ?? []),
		...(snapshot.scrapDealer?.recyclableItems ?? []),
		...(snapshot.royalBlacksmith?.upgradeableItems ?? [])
	];
	return candidates.find(item => item.itemCategory === data.itemCategory && item.itemId !== undefined && item.slot === data.slot);
}

export function cityItemIconPath(item: CityMobileItem): string {
	const itemType = ["weapons", "armors", "potions", "objects"][item.itemCategory] ?? "objects";
	return `${itemType}.${item.itemId}`;
}
