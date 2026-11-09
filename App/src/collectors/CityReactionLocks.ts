import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {
	enchantmentTransferForReaction, itemSnapshotForReaction
} from "@/src/collectors/CityItemPresentation";
import {
	buysMaterials, upgradeForReaction, upgradeTotalCost
} from "@/src/collectors/CityUpgrades";
import { formatMoney } from "@/src/display/Amounts";
import { formatTimeUntil } from "@/src/display/ItemEffects";
import {
	CircleAlert, Clock3, Coins, HeartPulse
} from "@/src/design/FightIcons";
import type { Lock } from "@/src/design/Sections";
import { gameRules } from "@/src/rules/GameRules";
import { i18n } from "@/src/translations/i18n";

const missingMoney = (amount: number): Lock => ({
	reason: i18n.t("app:city.locks.missingMoney", { amount: formatMoney(Math.max(0, amount)) }), icon: Coins
});
const blocked = (key: string): Lock => ({
	reason: i18n.t(key), icon: CircleAlert
});
const waiting = (key: string, availableAt: number | undefined, now: number): Lock => ({
	reason: i18n.t(key, { time: formatTimeUntil(availableAt ?? now, now) }), icon: Clock3
});

type LockResolver = (snapshot: CityMobileSnapshot | undefined, now: number) => Lock | undefined;

function homeLock(snapshot: CityMobileSnapshot | undefined, price: number | undefined): Lock | undefined {
	const manage = snapshot?.home?.manage;
	return manage && price !== undefined ? missingMoney(price - manage.currentMoney) : blocked("app:city.locks.unavailable");
}

const DIRECT_LOCKS: Partial<Record<ReactionCollectorReaction["type"], LockResolver>> = {
	[CITY_REACTION_KINDS.INN_MEAL]: (snapshot, now) => waiting("app:city.locks.mealCooldown", snapshot?.innCooldowns?.mealAvailableAt, now),
	[CITY_REACTION_KINDS.INN_ROOM]: (snapshot, now) => waiting("app:city.locks.roomCooldown", snapshot?.innCooldowns?.roomAvailableAt, now),
	[CITY_REACTION_KINDS.HOME_BED]: (snapshot, now) => snapshot?.health && snapshot.health.current >= snapshot.health.max
		? {
			reason: i18n.t("app:city.locks.healthFull"), icon: HeartPulse
		}
		: waiting("app:city.locks.roomCooldown", snapshot?.innCooldowns?.roomAvailableAt, now),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: snapshot => {
		const notary = snapshot?.guildDomainNotary;
		return notary
			? {
				reason: i18n.t("app:city.locks.guildTreasury", { amount: formatMoney(notary.cost) }), icon: Coins
			}
			: blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.APARTMENT_BUY]: snapshot => {
		const forSale = snapshot?.apartmentNotary?.forSale;
		return forSale ? missingMoney(forSale.missingMoney ?? forSale.price) : blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.BUY_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.newPrice),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.upgradePrice),
	[CITY_REACTION_KINDS.MOVE_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.movePrice),
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: () => blocked("app:city.locks.nothingToHarvest"),
	[CITY_REACTION_KINDS.GARDEN_WATER]: () => ({
		reason: i18n.t("app:city.locks.alreadyWatered"), icon: Clock3
	}),
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: () => blocked("app:city.locks.nothingToCompost")
};

/** Without buying, missing materials block the upgrade; buying them, only the coins for the whole bill can. */
function upgradeLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, playerMoney: number | undefined): Lock | undefined {
	const upgrade = upgradeForReaction(reaction, snapshot);
	if (!upgrade) {
		return blocked("app:city.locks.unavailable");
	}
	const buying = buysMaterials(reaction);
	if (!upgrade.hasAllMaterials && !buying) {
		return blocked("app:city.locks.missingMaterials");
	}
	const shortfall = upgradeTotalCost(upgrade, buying) - (playerMoney ?? 0);

	// The royal blacksmith also asks for gems, which the snapshot does not price: coins may well be enough.
	return shortfall > 0 ? missingMoney(shortfall) : blocked("app:city.locks.unavailable");
}

type ItemMatcher = (candidate: {
	slot: number; itemCategory: number;
}) => boolean;
type EquipmentLockResolver = (snapshot: CityMobileSnapshot | undefined, sameItem: ItemMatcher, reaction: ReactionCollectorReaction) => Lock | undefined;

function enchantmentTransferLock(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): Lock | undefined {
	const transfer = enchantmentTransferForReaction(snapshot, reaction);
	return transfer ? missingMoney(transfer.target.cost - (snapshot?.blacksmith?.playerMoney ?? 0)) : blocked("app:city.locks.unavailable");
}

const EQUIPMENT_LOCKS: Partial<Record<ReactionCollectorReaction["type"], EquipmentLockResolver>> = {
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: (snapshot, _sameItem, reaction) => upgradeLock(reaction, snapshot, 0),
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: (snapshot, _sameItem, reaction) => upgradeLock(reaction, snapshot, snapshot?.blacksmith?.playerMoney),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: (snapshot, _sameItem, reaction) => upgradeLock(reaction, snapshot, snapshot?.royalBlacksmith?.playerMoney),
	[CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER]: (snapshot, _sameItem, reaction) => enchantmentTransferLock(snapshot, reaction)
};

function equipmentLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock | undefined {
	const item = itemSnapshotForReaction(snapshot, reaction);
	const resolver = EQUIPMENT_LOCKS[reaction.type];
	if (!item || !resolver) {
		return blocked("app:city.locks.unavailable");
	}
	return resolver(snapshot, candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory, reaction);
}

/** A foothold earns nothing, which waiting would not change; a let apartment only needs time. */
function rentLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock {
	const apartmentId = (reaction.data as { apartmentId?: number }).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	if (apartment && !apartment.isRented) {
		return blocked("app:city.locks.notRented");
	}
	return {
		reason: i18n.t("app:city.locks.rentTooLow", {
			current: formatMoney(apartment?.accumulatedRent ?? 0), min: formatMoney(gameRules().apartment.minRentToClaim)
		}),
		icon: Clock3
	};
}

/** Why a row the player can see cannot be pressed, so the refusal is readable before the tap. */
export function cityReactionLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, now: number): Lock | undefined {
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		return rentLock(reaction, snapshot);
	}
	return DIRECT_LOCKS[reaction.type]?.(snapshot, now) ?? equipmentLock(reaction, snapshot);
}
