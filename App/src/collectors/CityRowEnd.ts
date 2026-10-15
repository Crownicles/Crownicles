import {
	CITY_REACTION_KINDS, CityMobileItem, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { formatMoney } from "@/src/display/Amounts";
import { itemSnapshotForReaction } from "@/src/collectors/CityItemPresentation";
import { upgradeForReaction } from "@/src/collectors/CityUpgrades";

/** The blacksmith's own fee: materials are gathered first, buying them is only the fallback. The home station is free. */
function upgradeEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const upgrade = upgradeForReaction(reaction, snapshot);
	return upgrade && upgrade.upgradeCost > 0 ? formatMoney(upgrade.upgradeCost) : undefined;
}

function disenchantEnd(snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (!item) {
		return undefined;
	}
	const disenchant = snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return disenchant ? formatMoney(disenchant.disenchantCost) : undefined;
}

function recycleEnd(snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (!item) {
		return undefined;
	}
	const recycle = snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return recycle && recycle.recoveredMoney > 0 ? formatMoney(recycle.recoveredMoney) : undefined;
}

function apartmentRentEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const apartmentId = (reaction.data as { apartmentId?: number }).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	return apartment && apartment.accumulatedRent > 0 ? formatMoney(apartment.accumulatedRent) : undefined;
}

type EndResolver = (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem) => string | undefined;

const END_RESOLVERS: Partial<Record<ReactionCollectorReaction["type"], EndResolver>> = {
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: (_reaction, snapshot) => snapshot?.guildDomainNotary ? formatMoney(snapshot.guildDomainNotary.cost) : undefined,
	[CITY_REACTION_KINDS.INN_MEAL]: reaction => formatMoney((reaction.data as { price: number }).price),
	[CITY_REACTION_KINDS.INN_ROOM]: reaction => formatMoney((reaction.data as { price: number }).price),
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: upgradeEnd,
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: upgradeEnd,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: upgradeEnd,
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: (_, snapshot, item) => disenchantEnd(snapshot, item),
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: (_, snapshot, item) => recycleEnd(snapshot, item),
	[CITY_REACTION_KINDS.BUY_HOME]: (_, snapshot) => snapshot?.home?.manage?.newPrice === undefined ? undefined : formatMoney(snapshot.home.manage.newPrice),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: (_, snapshot) => snapshot?.home?.manage?.upgradePrice === undefined ? undefined : formatMoney(snapshot.home.manage.upgradePrice),
	[CITY_REACTION_KINDS.MOVE_HOME]: (_, snapshot) => snapshot?.home?.manage?.movePrice === undefined ? undefined : formatMoney(snapshot.home.manage.movePrice),
	[CITY_REACTION_KINDS.APARTMENT_BUY]: (_, snapshot) => snapshot?.apartmentNotary?.forSale ? formatMoney(snapshot.apartmentNotary.forSale.price) : undefined,
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: apartmentRentEnd
};

export function cityRowEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	return END_RESOLVERS[reaction.type]?.(reaction, snapshot, itemSnapshotForReaction(snapshot, reaction));
}
