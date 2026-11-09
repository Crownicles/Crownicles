import {
	CITY_REACTION_KINDS,
	CityMobileEnchantedItem,
	CityMobileItem,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { AppIcons } from "@/src/AppIcons";
import { apartmentRentedHere } from "@/src/collectors/ApartmentBenefits";
import { compactCityDescription } from "@/src/collectors/CityText";
import {
	cityItemName, enchantedItemForReaction, enchantmentTransferForReaction, itemSnapshotForReaction
} from "@/src/collectors/CityItemPresentation";
import { materialUnits } from "@/src/collectors/CityRecycleDetails";
import {
	missingMaterialUnits, upgradeForReaction
} from "@/src/collectors/CityUpgrades";
import { formatMoney } from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

const CITY_SUBTITLE_KEYS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[CITY_REACTION_KINDS.EXIT]: "commands:report.city.reactions.exit.description",
	[CITY_REACTION_KINDS.ENCHANT]: "commands:report.city.reactions.enchanter.description",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "commands:report.city.blacksmith.menuDescription",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "commands:report.city.blacksmith.upgradeDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "commands:report.city.guildDomain.description",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "commands:report.city.guildDomain.notaryDescription",
	[CITY_REACTION_KINDS.BUY_HOME]: "app:city.subtitles.buyHome",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "app:city.subtitles.upgradeHome",
	[CITY_REACTION_KINDS.MOVE_HOME]: "app:city.subtitles.moveHome",
	[CITY_REACTION_KINDS.HOME_MENU]: "commands:report.city.homes.goToOwnedHomeDescription",
	[CITY_REACTION_KINDS.HOME_BED]: "commands:report.city.homes.bed.menuDescription"
};

function defaultSubtitle(reaction: ReactionCollectorReaction): string | undefined {
	const key = CITY_SUBTITLE_KEYS[reaction.type];
	return key ? compactCityDescription(i18n.t(key)) : undefined;
}

function apartmentRentSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	if (reaction.type !== CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		return undefined;
	}
	const apartmentId = (reaction.data as { apartmentId?: number }).apartmentId;
	const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
	return apartment
		? i18n.t(apartment.isRented ? "commands:report.city.homes.apartmentNotary.ownedLineRented" : "commands:report.city.homes.apartmentNotary.ownedLineEmpty", {
			mapLocationId: apartment.mapLocationId, rent: apartment.accumulatedRent
		})
		: defaultSubtitle(reaction);
}

function shopSubtitle(reaction: ReactionCollectorReaction): string {
	const { shopId } = reaction.data as { shopId: string };
	return compactCityDescription(i18n.t(`commands:report.city.shops.${shopId}.description`));
}

function innSubtitle(reaction: ReactionCollectorReaction): string {
	const data = reaction.data as {
		energy?: number; health?: number;
	};
	const detailKey = reaction.type === CITY_REACTION_KINDS.INN_MEAL ? "app:city.subtitles.mealDetails" : "app:city.subtitles.roomDetails";
	return i18n.t(detailKey, data);
}

function homeBedSubtitle(snapshot: CityMobileSnapshot | undefined, reaction: ReactionCollectorReaction): string | undefined {
	return snapshot?.home?.owned ? i18n.t("commands:report.city.homes.bed.menuDescription", { health: snapshot.home.owned.bedHealthRegeneration }) : defaultSubtitle(reaction);
}

/** Leaving pays the stay: the points already guaranteed are said on the way out. */
function exitSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	return snapshot?.minimumCityStayScore ? i18n.t("app:city.subtitles.exitStayScore", { count: snapshot.minimumCityStayScore }) : defaultSubtitle(reaction);
}

type ContextualResolver = (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => string | undefined;

const CONTEXTUAL_RESOLVERS: Partial<Record<ReactionCollectorReaction["type"], ContextualResolver>> = {
	[CITY_REACTION_KINDS.EXIT]: exitSubtitle,
	[CITY_REACTION_KINDS.SHOP]: reaction => shopSubtitle(reaction),
	[CITY_REACTION_KINDS.INN_MEAL]: reaction => innSubtitle(reaction),
	[CITY_REACTION_KINDS.INN_ROOM]: reaction => innSubtitle(reaction),
	[CITY_REACTION_KINDS.HOME_BED]: (reaction, snapshot) => homeBedSubtitle(snapshot, reaction),
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: (reaction, snapshot) => apartmentRentSubtitle(reaction, snapshot),
	[CITY_REACTION_KINDS.APARTMENT_BUY]: (_, snapshot) => i18n.t(apartmentRentedHere(snapshot) ? "app:city.subtitles.buyApartmentRented" : "app:city.subtitles.buyApartmentFoothold")
};

function contextualSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	return CONTEXTUAL_RESOLVERS[reaction.type]?.(reaction, snapshot);
}

function enchantSubtitle(snapshot: CityMobileSnapshot | undefined): string | undefined {
	return snapshot?.enchanter ? `${AppIcons.getIcon(`enchantmentTypes.${snapshot.enchanter.enchantmentType}`)} ${i18n.t(`items:enchantments.${snapshot.enchanter.enchantmentId}`)} · ${formatMoney(snapshot.enchanter.enchantmentCost.money)} et ${snapshot.enchanter.enchantmentCost.gems} ${AppIcons.getIcon("unitValues.gem")}` : undefined;
}

/** Ready, or how many materials the blacksmith will sell: the full list waits in the unfolded row. */
function upgradeSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	const upgrade = upgradeForReaction(reaction, snapshot);
	if (!upgrade) {
		return undefined;
	}
	const levels = {
		from: item.itemLevel, to: upgrade.nextLevel
	};
	return upgrade.hasAllMaterials
		? i18n.t("app:city.anvil.subtitleReady", levels)
		: i18n.t("app:city.anvil.subtitleMissing", {
			...levels, count: missingMaterialUnits(upgrade)
		});
}

function enchantmentLabel(item: CityMobileEnchantedItem): string {
	return `${AppIcons.getIcon(`enchantmentTypes.${item.enchantmentType}`)} ${i18n.t(`items:enchantments.${item.enchantmentId}`)}`;
}

function disenchantSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const disenchant = enchantedItemForReaction(snapshot, reaction);
	return disenchant ? i18n.t("app:city.subtitles.disenchantDetails", { enchantment: enchantmentLabel(disenchant) }) : undefined;
}

/** Which enchantment leaves the equipment named on the row, and the equipment that receives it. */
function enchantmentTransferSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const transfer = enchantmentTransferForReaction(snapshot, reaction);
	return transfer
		? i18n.t("app:city.subtitles.enchantmentTransferDetails", {
			enchantment: enchantmentLabel(transfer.source), target: cityItemName(transfer.target)
		})
		: undefined;
}

/** How much the dismantling gives back, the detail of each material waiting in the unfolded row. */
function recycleSubtitle(snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	const recycle = snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.slot === item.slot && candidate.itemCategory === item.itemCategory);
	return recycle
		? i18n.t("app:city.scrap.subtitle", {
			level: item.itemLevel, count: materialUnits(recycle.recoveredMaterials)
		})
		: undefined;
}

function itemSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item: CityMobileItem): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.ENCHANT: return enchantSubtitle(snapshot);
		case CITY_REACTION_KINDS.UPGRADE_ITEM:
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: return upgradeSubtitle(reaction, snapshot, item);
		case CITY_REACTION_KINDS.BLACKSMITH_ENCHANTMENT_TRANSFER: return enchantmentTransferSubtitle(reaction, snapshot);
		case CITY_REACTION_KINDS.ENCHANTER_DISENCHANT: return disenchantSubtitle(reaction, snapshot);
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE: return recycleSubtitle(snapshot, item);
		default: return undefined;
	}
}

export function cityRowSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined): string | undefined {
	const item = itemSnapshotForReaction(snapshot, reaction);
	return contextualSubtitle(reaction, snapshot) ?? (item ? itemSubtitle(reaction, snapshot, item) : undefined) ?? defaultSubtitle(reaction);
}
