import {CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
export function cityReactionAvailable(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	if (reaction.type === CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY) return snapshot?.guildDomainNotary?.canAfford ?? true;
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_BUY) return snapshot?.apartmentNotary?.forSale?.canAfford ?? true;
	if (reaction.type === CITY_REACTION_KINDS.BUY_HOME) return snapshot?.home?.manage?.canBuy ?? true;
	if (reaction.type === CITY_REACTION_KINDS.UPGRADE_HOME) return snapshot?.home?.manage?.canUpgrade ?? true;
	if (reaction.type === CITY_REACTION_KINDS.MOVE_HOME) return snapshot?.home?.manage?.canMove ?? true;
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
		return snapshot?.apartmentNotary?.ownedApartments.find(apartment => apartment.apartmentId === apartmentId)?.canClaim ?? true;
	}
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_HARVEST) return snapshot?.home?.owned?.garden?.eligibility.canHarvest ?? true;
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_WATER) return snapshot?.home?.owned?.garden?.eligibility.canWaterGarden ?? true;
	if (reaction.type === CITY_REACTION_KINDS.GARDEN_COMPOST) return snapshot?.home?.owned?.garden?.eligibility.canCompost ?? true;
	const item = itemSnapshotForReaction(snapshot, reaction);
	if (!item) return true;
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
