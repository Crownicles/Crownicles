import {
	CITY_REACTION_KINDS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";
import {formatMoney} from "@/src/display/Amounts";
import {formatTimeUntil} from "@/src/display/ItemEffects";
import {CircleAlert, Clock3, Coins} from "@/src/design/FightIcons";
import type {Lock} from "@/src/design/Sections";
import {gameRules} from "@/src/rules/GameRules";
import {i18n} from "@/src/translations/i18n";

const missingMoney = (amount: number): Lock => ({reason: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(Math.max(0, amount))}), icon: Coins});
const blocked = (key: string): Lock => ({reason: i18n.t(key), icon: CircleAlert});
const waiting = (key: string, availableAt: number | undefined): Lock => ({reason: i18n.t(key, {time: formatTimeUntil(availableAt ?? Date.now())}), icon: Clock3});

type LockResolver = (snapshot: CityMobileSnapshot | undefined) => Lock | undefined;

function homeLock(snapshot: CityMobileSnapshot | undefined, price: number | undefined): Lock | undefined {
	const manage = snapshot?.home?.manage;
	return manage && price !== undefined ? missingMoney(price - manage.currentMoney) : blocked("app:city.locks.unavailable");
}

const DIRECT_LOCKS: Partial<Record<ReactionCollectorReaction["type"], LockResolver>> = {
	[CITY_REACTION_KINDS.INN_MEAL]: snapshot => waiting("app:city.locks.mealCooldown", snapshot?.innCooldowns?.mealAvailableAt),
	[CITY_REACTION_KINDS.INN_ROOM]: snapshot => waiting("app:city.locks.roomCooldown", snapshot?.innCooldowns?.roomAvailableAt),
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: snapshot => {
		const notary = snapshot?.guildDomainNotary;
		return notary ? {reason: i18n.t("app:city.locks.guildTreasury", {amount: formatMoney(notary.cost)}), icon: Coins} : blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.APARTMENT_BUY]: snapshot => {
		const forSale = snapshot?.apartmentNotary?.forSale;
		return forSale ? missingMoney(forSale.missingMoney ?? forSale.price) : blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.BUY_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.newPrice),
	[CITY_REACTION_KINDS.UPGRADE_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.upgradePrice),
	[CITY_REACTION_KINDS.MOVE_HOME]: snapshot => homeLock(snapshot, snapshot?.home?.manage?.movePrice),
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: () => blocked("app:city.locks.nothingToHarvest"),
	[CITY_REACTION_KINDS.GARDEN_WATER]: () => ({reason: i18n.t("app:city.locks.alreadyWatered"), icon: Clock3}),
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: () => blocked("app:city.locks.nothingToCompost")
};

function upgradeLock(upgrade: CityMobileUpgradeItem | undefined, playerMoney: number | undefined): Lock | undefined {
	if (!upgrade) return blocked("app:city.locks.unavailable");
	if (!upgrade.hasAllMaterials && !upgrade.canBuyAndUpgrade) return blocked("app:city.locks.missingMaterials");
	return missingMoney(upgrade.upgradeCost + upgrade.missingMaterialsCost - (playerMoney ?? 0));
}

type ItemMatcher = (candidate: {slot: number; itemCategory: number}) => boolean;
type EquipmentLockResolver = (snapshot: CityMobileSnapshot | undefined, sameItem: ItemMatcher) => Lock | undefined;

function disenchantLock(blacksmith: CityMobileSnapshot["blacksmith"], sameItem: ItemMatcher): Lock | undefined {
	const disenchant = blacksmith?.disenchantableItems.find(sameItem);
	return disenchant ? missingMoney(disenchant.disenchantCost - (blacksmith?.playerMoney ?? 0)) : blocked("app:city.locks.unavailable");
}

const EQUIPMENT_LOCKS: Partial<Record<ReactionCollectorReaction["type"], EquipmentLockResolver>> = {
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: (snapshot, sameItem) => upgradeLock(snapshot?.blacksmith?.upgradeableItems.find(sameItem), snapshot?.blacksmith?.playerMoney),
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: (snapshot, sameItem) => upgradeLock(snapshot?.royalBlacksmith?.upgradeableItems.find(sameItem), snapshot?.royalBlacksmith?.playerMoney),
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: (snapshot, sameItem) => disenchantLock(snapshot?.blacksmith, sameItem)
};

function equipmentLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock | undefined {
	const item = itemSnapshotForReaction(snapshot, reaction);
	const resolver = EQUIPMENT_LOCKS[reaction.type];
	if (!item || !resolver) return blocked("app:city.locks.unavailable");
	return resolver(snapshot, candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
}

/** A foothold earns nothing, which waiting would not change; a let apartment only needs time. */
function rentLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock {
	const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	if (apartment && !apartment.isRented) return blocked("app:city.locks.notRented");
	return {reason: i18n.t("app:city.locks.rentTooLow", {current: formatMoney(apartment?.accumulatedRent ?? 0), min: formatMoney(gameRules().apartment.minRentToClaim)}), icon: Clock3};
}

/** Why a row the player can see cannot be pressed, so the refusal is readable before the tap. */
export function cityReactionLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock | undefined {
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) return rentLock(reaction, snapshot);
	return DIRECT_LOCKS[reaction.type]?.(snapshot) ?? equipmentLock(reaction, snapshot);
}
