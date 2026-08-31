import {ReactNode} from "react";
import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {cityIconPath, iconForPath} from "@/src/collectors/CityIcons";
import {cityItemIconPath, itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";

const ITEM_REACTION_TYPES = new Set<string>([
	CITY_REACTION_KINDS.ENCHANT,
	CITY_REACTION_KINDS.BLACKSMITH_UPGRADE,
	CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE,
	CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE
]);

function disenchantIcon(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): ReactNode | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) return undefined;
	const item = itemSnapshotForReaction(snapshot, reaction);
	const disenchant = item && snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return disenchant ? iconForPath(`enchantmentTypes.${disenchant.enchantmentType}`) : undefined;
}

function itemReactionIcon(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): ReactNode | undefined {
	if (!ITEM_REACTION_TYPES.has(reaction.type)) return undefined;
	const item = itemSnapshotForReaction(snapshot, reaction);
	return item ? iconForPath(cityItemIconPath(item)) : undefined;
}

export function cityRowIcon(reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot): ReactNode | undefined {
	return disenchantIcon(reaction, snapshot) ?? itemReactionIcon(reaction, snapshot) ?? (() => {
		const iconPath = cityIconPath(reaction);
		return iconPath ? iconForPath(iconPath) : undefined;
	})();
}
