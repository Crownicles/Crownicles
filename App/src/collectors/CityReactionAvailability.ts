import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {
	enchantmentTransferForReaction, itemSnapshotForReaction
} from "@/src/collectors/CityItemPresentation";
import {
	buysMaterials, isUpgradeReaction, upgradeForReaction
} from "@/src/collectors/CityUpgrades";

type AvailabilityResolver = (snapshot: CityMobileSnapshot | undefined, now: number) => boolean;

type HomeManage = NonNullable<NonNullable<CityMobileSnapshot["home"]>["manage"]>;

/** Core only sends the eligibility it grants: once the notary's offer is known, a missing flag is a refusal. */
function homeManageAvailability(snapshot: CityMobileSnapshot | undefined, granted: (manage: HomeManage) => boolean | undefined): boolean {
	const manage = snapshot?.home?.manage;
	return manage ? granted(manage) === true : true;
}

/** Core only sends when an inn serves again while that moment is still to come; it may have passed since. */
function servedNow(availableAt: number | undefined, now: number): boolean {
	return availableAt === undefined || availableAt <= now;
}

function healthFull(snapshot: CityMobileSnapshot | undefined): boolean {
	return snapshot?.health !== undefined && snapshot.health.current >= snapshot.health.max;
}

const DIRECT_AVAILABILITY: Partial<Record<ReactionCollectorReaction["type"], AvailabilityResolver>> = {
	[CITY_REACTION_KINDS.INN_MEAL]: (snapshot, now) => servedNow(snapshot?.innCooldowns?.mealAvailableAt, now),
	[CITY_REACTION_KINDS.INN_ROOM]: (snapshot, now) => servedNow(snapshot?.innCooldowns?.roomAvailableAt, now),
	[CITY_REACTION_KINDS.HOME_BED]: (snapshot, now) => servedNow(snapshot?.innCooldowns?.roomAvailableAt, now) && !healthFull(snapshot),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: snapshot => snapshot?.guildDomainNotary?.canAfford ?? true,
	[CITY_REACTION_KINDS.APARTMENT_BUY]: snapshot => snapshot?.apartmentNotary?.forSale?.canAfford ?? true,
	[CITY_REACTION_KINDS.BUY_HOME]: snapshot => homeManageAvailability(snapshot, manage => manage.canBuy),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: snapshot => homeManageAvailability(snapshot, manage => manage.canUpgrade),
	[CITY_REACTION_KINDS.MOVE_HOME]: snapshot => homeManageAvailability(snapshot, manage => manage.canMove),
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canHarvest ?? true,
	[CITY_REACTION_KINDS.GARDEN_WATER]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canWaterGarden ?? true,
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: snapshot => snapshot?.home?.owned?.garden?.eligibility.canCompost ?? true
};

function directAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, now: number): boolean | undefined {
	return DIRECT_AVAILABILITY[reaction.type]?.(snapshot, now);
}

function apartmentRentAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		return undefined;
	}
	const apartmentId = (reaction.data as { apartmentId?: number }).apartmentId;
	return snapshot?.apartmentNotary?.ownedApartments.find(apartment => apartment.apartmentId === apartmentId)?.canClaim ?? true;
}

function upgradeAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	const upgrade = upgradeForReaction(reaction, snapshot);
	if (!upgrade) {
		return true;
	}
	return buysMaterials(reaction) ? upgrade.canBuyAndUpgrade : upgrade.canUpgrade;
}

function equipmentAvailability(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): boolean {
	if (isUpgradeReaction(reaction)) {
		return upgradeAvailability(reaction, snapshot);
	}
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER) {
		return enchantmentTransferForReaction(snapshot, reaction)?.target.canAfford ?? true;
	}
	return true;
}

export function cityReactionAvailable(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, now: number): boolean {
	const direct = directAvailability(reaction, snapshot, now);
	if (direct !== undefined) {
		return direct;
	}
	const rent = apartmentRentAvailability(reaction, snapshot);
	if (rent !== undefined) {
		return rent;
	}
	const item = itemSnapshotForReaction(snapshot, reaction);
	return item ? equipmentAvailability(reaction, snapshot) : true;
}
