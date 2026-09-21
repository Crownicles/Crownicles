import {
	CITY_REACTION_KINDS, CityMobileSnapshot, CityMobileUpgradeItem, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";
import {formatMoney} from "@/src/display/Amounts";
import {CircleAlert, Clock3, Coins} from "@/src/design/FightIcons";
import type {Lock} from "@/src/design/Sections";
import {i18n} from "@/src/translations/i18n";

const missingMoney = (amount: number): Lock => ({reason: i18n.t("app:city.locks.missingMoney", {amount: formatMoney(Math.max(0, amount))}), icon: Coins});
const blocked = (key: string): Lock => ({reason: i18n.t(key), icon: CircleAlert});

type LockResolver = (snapshot: CityMobileSnapshot | undefined) => Lock | undefined;

function homeLock(snapshot: CityMobileSnapshot | undefined, price: number | undefined): Lock | undefined {
	const manage = snapshot?.home?.manage;
	return manage && price !== undefined ? missingMoney(price - manage.currentMoney) : blocked("app:city.locks.unavailable");
}

const DIRECT_LOCKS: Partial<Record<ReactionCollectorReaction["type"], LockResolver>> = {
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: snapshot => {
		const notary = snapshot?.guildDomainNotary;
		return notary ? {reason: i18n.t("app:city.locks.guildTreasury", {amount: formatMoney(notary.cost)}), icon: Coins} : blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.APARTMENT_BUY]: snapshot => {
		const forSale = snapshot?.apartmentNotary?.forSale;
		return forSale ? missingMoney(forSale.missingMoney ?? forSale.price) : blocked("app:city.locks.unavailable");
	},
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: () => ({reason: i18n.t("app:city.locks.noRent"), icon: Clock3}),
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

function equipmentLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock | undefined {
	const item = itemSnapshotForReaction(snapshot, reaction);
	if (!item) return blocked("app:city.locks.unavailable");
	const sameItem = <T extends {slot: number; itemCategory: number}>(candidate: T): boolean => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory;
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE) return upgradeLock(snapshot?.blacksmith?.upgradeableItems.find(sameItem), snapshot?.blacksmith?.playerMoney);
	if (reaction.type === CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE) return upgradeLock(snapshot?.royalBlacksmith?.upgradeableItems.find(sameItem), snapshot?.royalBlacksmith?.playerMoney);
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) {
		const disenchant = snapshot?.blacksmith?.disenchantableItems.find(sameItem);
		return disenchant ? missingMoney(disenchant.disenchantCost - (snapshot?.blacksmith?.playerMoney ?? 0)) : blocked("app:city.locks.unavailable");
	}
	return blocked("app:city.locks.unavailable");
}

/** Why a row the player can see cannot be pressed, so the refusal is readable before the tap. */
export function cityReactionLock(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): Lock | undefined {
	return DIRECT_LOCKS[reaction.type]?.(snapshot) ?? equipmentLock(reaction, snapshot);
}
