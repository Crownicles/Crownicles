import {CITY_REACTION_KINDS, CityMobileItem, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/collectors/CityText";

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function upgradeEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (!item) return undefined;
	const upgrades = reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE ? snapshot?.blacksmith?.upgradeableItems : snapshot?.royalBlacksmith?.upgradeableItems;
	const upgrade = upgrades?.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return upgrade ? formatMoney(upgrade.upgradeCost) : undefined;
}

function disenchantEnd(snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (!item) return undefined;
	const disenchant = snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return disenchant ? formatMoney(disenchant.disenchantCost) : undefined;
}

function recycleEnd(snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (!item) return undefined;
	const recycle = snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return recycle && recycle.recoveredMoney > 0 ? formatMoney(recycle.recoveredMoney) : undefined;
}

function apartmentRentEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	return apartment && apartment.accumulatedRent > 0 ? formatMoney(apartment.accumulatedRent) : undefined;
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional")
function cityRowEndForReaction(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.INN_MEAL:
		case CITY_REACTION_KINDS.INN_ROOM:
			return formatMoney(reaction.data.price);
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE:
			return upgradeEnd(reaction, snapshot, item);
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
			return disenchantEnd(snapshot, item);
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE:
			return recycleEnd(snapshot, item);
		case CITY_REACTION_KINDS.BUY_HOME:
			return snapshot?.home?.manage?.newPrice === undefined ? undefined : formatMoney(snapshot.home.manage.newPrice);
		case CITY_REACTION_KINDS.UPGRADE_HOME:
			return snapshot?.home?.manage?.upgradePrice === undefined ? undefined : formatMoney(snapshot.home.manage.upgradePrice);
		case CITY_REACTION_KINDS.MOVE_HOME:
			return snapshot?.home?.manage?.movePrice === undefined ? undefined : formatMoney(snapshot.home.manage.movePrice);
		case CITY_REACTION_KINDS.APARTMENT_BUY:
			return snapshot?.apartmentNotary?.forSale ? formatMoney(snapshot.apartmentNotary.forSale.price) : undefined;
		case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT:
			return apartmentRentEnd(reaction, snapshot);
		default:
			return undefined;
	}
}

export function cityRowEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	return cityRowEndForReaction(reaction, snapshot, item);
}
