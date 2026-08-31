import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS,
	CityMobileItem, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {reactionLabel} from "@/src/collectors/CollectorLabels";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const CITY_ICON_PATHS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[CITY_REACTION_KINDS.EXIT]: "city.exit",
	[CITY_REACTION_KINDS.INN_MEAL]: "city.inn",
	[CITY_REACTION_KINDS.INN_ROOM]: "city.inn",
	[CITY_REACTION_KINDS.ENCHANT]: "city.services.enchanter",
	[CITY_REACTION_KINDS.BUY_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.MOVE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.HOME_MENU]: "city.home.5",
	[CITY_REACTION_KINDS.HOME_BED]: "city.homeUpgrades.bed",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "city.homeUpgrades.upgradeEquipment",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "city.blacksmith.disenchant",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_WATER]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "city.guildDomain.menu",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "city.guildDomainNotary",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "city.apartmentNotary.menu",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "city.apartmentNotary.menu"
};

function cityIconPath(reaction: ReactionCollectorReaction): string | undefined {
	return reaction.type === CITY_REACTION_KINDS.SHOP ? `city.shops.${reaction.data.shopId}` : CITY_ICON_PATHS[reaction.type];
}

export function iconForPath(iconPath: string): ReactNode | undefined {
	const emoji = AppIcons.getIconOrNull(iconPath);
	return emoji ? <TwemojiIcon emoji={emoji} size={Theme.fontSize.rowTitle} /> : undefined;
}

function cityItemName(item: {itemId: number; itemCategory: number}): string {
	const itemType = ["weapon", "armor", "potion", "object"][item.itemCategory] ?? "object";
	return i18n.t(`models:${itemType}s.${item.itemId}`);
}

// @codescene(disable:"Complex Method")
function cityItem(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	if (!snapshot) return undefined;
	const data = reaction.data as {slot?: number; itemCategory?: number};
	if (data.itemCategory === undefined || data.slot === undefined) return undefined;
	const candidates = [
		...(snapshot.enchanter?.enchantableItems ?? []),
		...(snapshot.blacksmith?.upgradeableItems ?? []),
		...(snapshot.blacksmith?.disenchantableItems ?? []),
		...(snapshot.scrapDealer?.recyclableItems ?? []),
		...(snapshot.royalBlacksmith?.upgradeableItems ?? [])
	];
	return candidates.find(item => item.itemCategory === data.itemCategory && item.itemId !== undefined && item.slot === data.slot);
}

export function itemSnapshotForReaction(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): CityMobileItem | undefined {
	return cityItem(snapshot, reaction);
}

function cityItemIconPath(item: CityMobileItem): string {
	const itemType = ["weapons", "armors", "potions", "objects"][item.itemCategory] ?? "objects";
	return `${itemType}.${item.itemId}`;
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional", disable:"Bumpy Road Ahead")
export function cityRowIcon(reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot): ReactNode | undefined {
	if (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		const disenchant = item && snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
		const enchantmentIcon = disenchant && iconForPath(`enchantmentTypes.${disenchant.enchantmentType}`);
		if (enchantmentIcon) return enchantmentIcon;
	}
	if (reaction.type === CITY_REACTION_KINDS.ENCHANT
		|| reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE
		|| reaction.type === CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE
		|| reaction.type === CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE) {
		const item = itemSnapshotForReaction(snapshot, reaction);
		if (item) return iconForPath(cityItemIconPath(item));
	}
	const iconPath = cityIconPath(reaction);
	return iconPath ? iconForPath(iconPath) : undefined;
}

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
		default:
			return true;
	}
}

// @codescene(disable:"Complex Method", disable:"Complex Conditional", disable:"Large Method")
export function cityRowTitle(reaction: ReactionCollectorReaction, collectorData: ReactionCollectorCreation["data"], snapshot?: CityMobileSnapshot): string {
	if (collectorData.type !== CITY_DATA_KINDS.CITY) return reactionLabel(reaction, collectorData);
	switch (reaction.type) {
		case CITY_REACTION_KINDS.HOME_MENU: return i18n.t("app:city.actions.home");
		case CITY_REACTION_KINDS.HOME_BED: return i18n.t("commands:report.city.homes.bed.buttonLabel");
		case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY: return snapshot?.guildDomainNotary?.hasDomain ? i18n.t("commands:report.city.guildDomain.confirmRelocate") : i18n.t("commands:report.city.guildDomain.confirmPurchase");
		case CITY_REACTION_KINDS.APARTMENT_BUY: return i18n.t("commands:report.city.homes.apartmentNotary.buyButtonLabel");
		case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT: {
			const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
			const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
			return apartment ? i18n.t(`models:map_locations.${apartment.mapLocationId}.name`) : reactionLabel(reaction, collectorData);
		}
		case CITY_REACTION_KINDS.GARDEN_HARVEST: return i18n.t("commands:report.city.homes.garden.harvestButton");
		case CITY_REACTION_KINDS.GARDEN_WATER: return i18n.t("commands:report.city.homes.garden.waterButton");
		case CITY_REACTION_KINDS.INN_MEAL: return i18n.t(`commands:report.city.inns.meals.${reaction.data.mealId}`);
		case CITY_REACTION_KINDS.INN_ROOM: return i18n.t(`commands:report.city.inns.rooms.${reaction.data.roomId}`);
		case CITY_REACTION_KINDS.SHOP: return i18n.t(`commands:report.city.shops.${reaction.data.shopId}.label`);
		case CITY_REACTION_KINDS.EXIT: return i18n.t("commands:report.city.reactions.exit.label");
		case CITY_REACTION_KINDS.ENCHANT:
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
			const item = itemSnapshotForReaction(snapshot, reaction);
			return item ? cityItemName(item) : reactionLabel(reaction, collectorData);
		}
		default: return reactionLabel(reaction, collectorData);
	}
}
