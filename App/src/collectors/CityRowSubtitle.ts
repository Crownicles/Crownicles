import {
	CITY_REACTION_KINDS,
	CityMobileItem,
	CityMobileUpgradeItem,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {compactCityDescription, formatMoney, materialSummary} from "@/src/collectors/CityText";
import {i18n} from "@/src/translations/i18n";

const CITY_SUBTITLE_KEYS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[CITY_REACTION_KINDS.EXIT]: "commands:report.city.reactions.exit.description",
	[CITY_REACTION_KINDS.ENCHANT]: "commands:report.city.reactions.enchanter.description",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "commands:report.city.blacksmith.menuDescription",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "commands:report.city.blacksmith.upgradeDescription",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "commands:report.city.blacksmith.disenchantDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "commands:report.city.guildDomain.description",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "commands:report.city.guildDomain.notaryDescription",
	[CITY_REACTION_KINDS.BUY_HOME]: "commands:report.city.homes.manageHomeDescriptionNew",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "commands:report.city.homes.manageHomeDescriptionUpgrade",
	[CITY_REACTION_KINDS.MOVE_HOME]: "commands:report.city.homes.manageHomeDescriptionMove",
	[CITY_REACTION_KINDS.HOME_MENU]: "commands:report.city.homes.goToOwnedHomeDescription",
	[CITY_REACTION_KINDS.HOME_BED]: "commands:report.city.homes.bed.menuDescription"
};

function defaultSubtitle(reaction: ReactionCollectorReaction): string | undefined {
	const key = CITY_SUBTITLE_KEYS[reaction.type];
	return key ? compactCityDescription(i18n.t(key)) : undefined;
}

function apartmentRentSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) return undefined;
	const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	return apartment ? i18n.t(apartment.isRented ? "commands:report.city.homes.apartmentNotary.ownedLineRented" : "commands:report.city.homes.apartmentNotary.ownedLineEmpty", {mapLocationId: apartment.mapLocationId, rent: apartment.accumulatedRent}) : defaultSubtitle(reaction);
}

function shopSubtitle(reaction: ReactionCollectorReaction): string {
	const {shopId} = reaction.data as {shopId: string};
	return compactCityDescription(i18n.t(`commands:report.city.shops.${shopId}.description`));
}

function innSubtitle(reaction: ReactionCollectorReaction): string {
	const data = reaction.data as {innId: string; mealId?: string; roomId?: string; price?: number; energy?: number; health?: number};
	const detailKey = reaction.type === CITY_REACTION_KINDS.INN_MEAL ? "app:city.subtitles.mealDetails" : "app:city.subtitles.roomDetails";
	return `${i18n.t(`commands:report.city.inns.names.${data.innId}`)} · ${i18n.t(detailKey, data)}`;
}

function homeBedSubtitle(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): string | undefined {
	return snapshot?.home?.owned ? i18n.t("commands:report.city.homes.bed.menuDescription", {health: snapshot.home.owned.bedHealthRegeneration}) : defaultSubtitle(reaction);
}

function apartmentBuySubtitle(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): string | undefined {
	const sale = snapshot?.apartmentNotary?.forSale;
	return sale ? i18n.t(sale.canAfford ? "commands:report.city.homes.apartmentNotary.forSaleDescription" : "commands:report.city.homes.apartmentNotary.buyNotEnoughMoney", {price: sale.price, cost: sale.price, missingMoney: sale.missingMoney ?? 0}) : defaultSubtitle(reaction);
}

type ContextualResolver = (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => string | undefined;

const CONTEXTUAL_RESOLVERS: Partial<Record<ReactionCollectorReaction["type"], ContextualResolver>> = {
	[CITY_REACTION_KINDS.SHOP]: reaction => shopSubtitle(reaction),
	[CITY_REACTION_KINDS.INN_MEAL]: reaction => innSubtitle(reaction),
	[CITY_REACTION_KINDS.INN_ROOM]: reaction => innSubtitle(reaction),
	[CITY_REACTION_KINDS.HOME_BED]: (reaction, snapshot) => homeBedSubtitle(snapshot, reaction),
	[CITY_REACTION_KINDS.APARTMENT_BUY]: (reaction, snapshot) => apartmentBuySubtitle(snapshot, reaction),
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: (reaction, snapshot) => apartmentRentSubtitle(reaction, snapshot)
};

function contextualSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	return CONTEXTUAL_RESOLVERS[reaction.type]?.(reaction, snapshot);
}

function enchantSubtitle(snapshot: CityMobileSnapshot | undefined): string | undefined {
	return snapshot?.enchanter ? `${AppIcons.getIcon(`enchantmentTypes.${snapshot.enchanter.enchantmentType}`)} ${i18n.t(`items:enchantments.${snapshot.enchanter.enchantmentId}`)} · ${formatMoney(snapshot.enchanter.enchantmentCost.money)} et ${snapshot.enchanter.enchantmentCost.gems} ${AppIcons.getIcon("unitValues.gem")}` : undefined;
}

type UpgradeItemsResolver = (snapshot: CityMobileSnapshot | undefined) => CityMobileUpgradeItem[] | undefined;

const UPGRADE_ITEMS_RESOLVERS: Partial<Record<ReactionCollectorReaction["type"], UpgradeItemsResolver>> = {
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: snapshot => snapshot?.blacksmith?.upgradeableItems,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: snapshot => snapshot?.royalBlacksmith?.upgradeableItems
};

function missingMaterialsSubtitle(upgrade: CityMobileUpgradeItem, buyMaterials: boolean | undefined): string {
	if (upgrade.hasAllMaterials || !buyMaterials) return "";
	return i18n.t("app:city.summary.missingMaterials", {price: formatMoney(upgrade.missingMaterialsCost)});
}

function upgradeSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	const upgrades = UPGRADE_ITEMS_RESOLVERS[reaction.type]?.(snapshot);
	const upgrade = upgrades?.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	if (!upgrade) return undefined;
	const buyMaterials = (reaction.data as {buyMaterials?: boolean}).buyMaterials;
	const missingMaterials = missingMaterialsSubtitle(upgrade, buyMaterials);
	return i18n.t("app:city.subtitles.upgradeDetails", {from: item.itemLevel, to: upgrade.nextLevel, materials: materialSummary(upgrade.materials), missingMaterials});
}

function disenchantSubtitle(snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	const disenchant = snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return disenchant ? i18n.t("app:city.subtitles.disenchantDetails", {enchantment: `${AppIcons.getIcon(`enchantmentTypes.${disenchant.enchantmentType}`)} ${i18n.t(`items:enchantments.${disenchant.enchantmentId}`)}`}) : undefined;
}

function recycleSubtitle(snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	const recycle = snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
	return recycle ? i18n.t("app:city.subtitles.recycleDetails", {materials: recycle.recoveredMaterials.map(material => `${material.quantity} × ${i18n.t(`models:materials.${material.materialId}`)}`).join(", ")}) : undefined;
}

function itemSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.ENCHANT: return enchantSubtitle(snapshot);
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: return upgradeSubtitle(reaction, snapshot, item);
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT: return disenchantSubtitle(snapshot, item);
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE: return recycleSubtitle(snapshot, item);
		default: return undefined;
	}
}

export function cityRowSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	return contextualSubtitle(reaction, snapshot) ?? (item ? itemSubtitle(reaction, snapshot, item) : undefined) ?? defaultSubtitle(reaction);
}
