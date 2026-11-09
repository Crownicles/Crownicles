import {
	CITY_REACTION_KINDS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";

type UpgradeReactionData = {
	slot?: number; itemCategory?: number; buyMaterials?: boolean;
};

const UPGRADE_SOURCES: Partial<Record<ReactionCollectorReaction["type"], (snapshot: CityMobileSnapshot | undefined) => CityMobileUpgradeItem[] | undefined>> = {
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: snapshot => snapshot?.home?.owned?.upgradeStation?.upgradeableItems,
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: snapshot => snapshot?.blacksmith?.upgradeableItems,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: snapshot => snapshot?.royalBlacksmith?.upgradeableItems
};

export function isUpgradeReaction(reaction: ReactionCollectorReaction): boolean {
	return UPGRADE_SOURCES[reaction.type] !== undefined;
}

/** The item a blacksmith upgrade works on, as the snapshot describes it. */
export function upgradeForReaction(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): CityMobileUpgradeItem | undefined {
	const data = reaction.data as UpgradeReactionData;
	return UPGRADE_SOURCES[reaction.type]?.(snapshot)?.find(item => item.slot === data.slot && item.itemCategory === data.itemCategory);
}

export function buysMaterials(reaction: ReactionCollectorReaction): boolean {
	return (reaction.data as UpgradeReactionData).buyMaterials === true;
}

/** What the upgrade costs in coins, missing materials included when the blacksmith sells them. */
export function upgradeTotalCost(upgrade: CityMobileUpgradeItem, buyingMaterials: boolean): number {
	return upgrade.upgradeCost + (buyingMaterials ? upgrade.missingMaterialsCost : 0);
}

export function missingMaterialUnits(upgrade: CityMobileUpgradeItem): number {
	return upgrade.materials.reduce((total, material) => total + Math.max(0, material.quantity - material.playerQuantity), 0);
}

/**
 * The blacksmiths offer each upgrade twice, with and without buying the missing materials: the player
 * only sees the one that fits, so an item lies once on the anvil. The home station offers it once.
 */
export function isShownUpgradeVariant(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	if (!isUpgradeReaction(reaction) || (reaction.data as UpgradeReactionData).buyMaterials === undefined) {
		return true;
	}
	const upgrade = upgradeForReaction(reaction, snapshot);
	return buysMaterials(reaction) === (upgrade ? !upgrade.hasAllMaterials : false);
}
