import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";

function directAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY: return snapshot?.guildDomainNotary?.canAfford ?? true;
		case CITY_REACTION_KINDS.APARTMENT_BUY: return snapshot?.apartmentNotary?.forSale?.canAfford ?? true;
		case CITY_REACTION_KINDS.BUY_HOME: return snapshot?.home?.manage?.canBuy ?? true;
		case CITY_REACTION_KINDS.UPGRADE_HOME: return snapshot?.home?.manage?.canUpgrade ?? true;
		case CITY_REACTION_KINDS.MOVE_HOME: return snapshot?.home?.manage?.canMove ?? true;
		case CITY_REACTION_KINDS.GARDEN_HARVEST: return snapshot?.home?.owned?.garden?.eligibility.canHarvest ?? true;
		case CITY_REACTION_KINDS.GARDEN_WATER: return snapshot?.home?.owned?.garden?.eligibility.canWaterGarden ?? true;
		case CITY_REACTION_KINDS.GARDEN_COMPOST: return snapshot?.home?.owned?.garden?.eligibility.canCompost ?? true;
		default: return undefined;
	}
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
