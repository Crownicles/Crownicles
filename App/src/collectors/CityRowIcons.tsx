import {ReactNode} from "react";
import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {cityIconPath, iconForPath} from "@/src/collectors/CityIcons";
import {cityItemIconPath, itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";

// @codescene(disable:"Complex Method", disable:"Complex Conditional", disable:"Bumpy Road Ahead")
export function cityRowIcon(reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot): ReactNode | undefined {
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		const disenchant = item && snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
		const enchantmentIcon = disenchant && iconForPath(`enchantmentTypes.${disenchant.enchantmentType}`);
		if (enchantmentIcon) return enchantmentIcon;
	}
	if (reaction.type === CITY_REACTION_KINDS.ENCHANT
		|| reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE
		|| reaction.type === CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE
		|| reaction.type === CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		if (item) return iconForPath(cityItemIconPath(item));
	}
	const iconPath = cityIconPath(reaction);
	return iconPath ? iconForPath(iconPath) : undefined;
}
