import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
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

function equipmentAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: NonNullable<ReturnType<typeof itemSnapshotForReaction>>): boolean {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE: {
			const upgrade = snapshot?.blacksmith?.upgradeableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
			return reaction.data.buyMaterials ? upgrade?.canBuyAndUpgrade ?? true : upgrade?.canUpgrade ?? true;
		}
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
			return snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory)?.canDisenchant ?? true;
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
			const upgrade = snapshot?.royalBlacksmith?.upgradeableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
			return reaction.data.buyMaterials ? upgrade?.canBuyAndUpgrade ?? true : upgrade?.canUpgrade ?? true;
		}
		default: return true;
	}
}

export function cityReactionAvailable(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	const direct = directAvailability(reaction, snapshot);
	if (direct !== undefined) return direct;
	const rent = apartmentRentAvailability(reaction, snapshot);
	if (rent !== undefined) return rent;
	const item = itemSnapshotForReaction(snapshot, reaction);
	return item ? equipmentAvailability(reaction, snapshot, item) : true;
}
