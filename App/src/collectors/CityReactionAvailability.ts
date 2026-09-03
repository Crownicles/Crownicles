import {CITY_REACTION_KINDS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";

type AvailabilityResolver = (snapshot: CityMobileSnapshot | undefined) => boolean;

const DIRECT_AVAILABILITY: Partial<Record<ReactionCollectorReaction["type"], AvailabilityResolver>> = {
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: snapshot => snapshot?.guildDomainNotary?.canAfford ?? true,
	[CITY_REACTION_KINDS.APARTMENT_BUY]: snapshot => snapshot?.apartmentNotary?.forSale?.canAfford ?? true,
	[CITY_REACTION_KINDS.BUY_HOME]: snapshot => snapshot?.home?.manage?.canBuy ?? true,
	[CITY_REACTION_KINDS.UPGRADE_HOME]: snapshot => snapshot?.home?.manage?.canUpgrade ?? true,
	[CITY_REACTION_KINDS.MOVE_HOME]: snapshot => snapshot?.home?.manage?.canMove ?? true,
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canHarvest ?? true,
	[CITY_REACTION_KINDS.GARDEN_WATER]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canWaterGarden ?? true,
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canCompost ?? true
};

function directAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean | undefined {
	return DIRECT_AVAILABILITY[reaction.type]?.(snapshot);
}

function apartmentRentAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) return undefined;
	const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
	return snapshot?.apartmentNotary?.ownedApartments.find(apartment => apartment.apartmentId === apartmentId)?.canClaim ?? true;
}

type UpgradeItemsResolver = (snapshot: CityMobileSnapshot | undefined) => CityMobileUpgradeItem[] | undefined;

const UPGRADE_ITEMS_RESOLVERS: Record<"blacksmith" | "royalBlacksmith", UpgradeItemsResolver> = {
	blacksmith: snapshot => snapshot?.blacksmith?.upgradeableItems,
	royalBlacksmith: snapshot => snapshot?.royalBlacksmith?.upgradeableItems
};

function upgradeCanUse(upgrade: CityMobileUpgradeItem | undefined, buyMaterials: boolean | undefined): boolean {
	if (!upgrade) return true;
	return buyMaterials ? upgrade.canBuyAndUpgrade : upgrade.canUpgrade;
}

function upgradeAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: NonNullable<ReturnType<typeof itemSnapshotForReaction>>, source: "blacksmith" | "royalBlacksmith"): boolean {
	const upgrades = UPGRADE_ITEMS_RESOLVERS[source](snapshot);
	const upgrade = upgrades?.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
	const buyMaterials = (reaction.data as {buyMaterials?: boolean}).buyMaterials;
	return upgradeCanUse(upgrade, buyMaterials);
}

function equipmentAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: NonNullable<ReturnType<typeof itemSnapshotForReaction>>): boolean {
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE) return upgradeAvailability(reaction, snapshot, item, "blacksmith");
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) return snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory)?.canDisenchant ?? true;
	if (reaction.type === CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE) return upgradeAvailability(reaction, snapshot, item, "royalBlacksmith");
	return true;
}

export function cityReactionAvailable(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	const direct = directAvailability(reaction, snapshot);
	if (direct !== undefined) return direct;
	const rent = apartmentRentAvailability(reaction, snapshot);
	if (rent !== undefined) return rent;
	const item = itemSnapshotForReaction(snapshot, reaction);
	return item ? equipmentAvailability(reaction, snapshot, item) : true;
}
