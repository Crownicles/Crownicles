import {
	CITY_REACTION_KINDS,
	CityMobileItem,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
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

export function compactCityDescription(description: string): string {
	const firstParagraph = description.split("\n\n")[0].trim();
	const firstSentence = firstParagraph.match(/^.*?[.!?](?:\s|$)/)?.[0];
	return (firstSentence ?? firstParagraph).trim();
}

function formatMoney(value: number): string {
	return `${value.toLocaleString("fr-FR")} ${AppIcons.getIcon("unitValues.money")}`;
}

function materialSummary(materials: {materialId: number; quantity: number; playerQuantity: number}[]): string {
	return materials.map(material => `${material.quantity} × ${i18n.t(`models:materials.${material.materialId}`)} (${material.playerQuantity})`).join(", ");
}

// @codescene(disable:"Complex Method", disable:"Large Method", disable:"Bumpy Road Ahead")
export function cityRowSubtitle(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	if (reaction.type === CITY_REACTION_KINDS.SHOP) {
		return compactCityDescription(i18n.t(`commands:report.city.shops.${reaction.data.shopId}.description`));
	}
	if (reaction.type === CITY_REACTION_KINDS.INN_MEAL || reaction.type === CITY_REACTION_KINDS.INN_ROOM) {
		const detailKey = reaction.type === CITY_REACTION_KINDS.INN_MEAL ? "app:city.subtitles.mealDetails" : "app:city.subtitles.roomDetails";
		return `${i18n.t(`commands:report.city.inns.names.${reaction.data.innId}`)} · ${i18n.t(detailKey, reaction.data)}`;
	}
	if (reaction.type === CITY_REACTION_KINDS.HOME_BED && snapshot?.home?.owned) {
		return i18n.t("commands:report.city.homes.bed.menuDescription", {health: snapshot.home.owned.bedHealthRegeneration});
	}
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_BUY && snapshot?.apartmentNotary?.forSale) {
		const sale = snapshot.apartmentNotary.forSale;
		return i18n.t(sale.canAfford
			? "commands:report.city.homes.apartmentNotary.forSaleDescription"
			: "commands:report.city.homes.apartmentNotary.buyNotEnoughMoney", {
			price: sale.price,
			cost: sale.price,
			missingMoney: sale.missingMoney ?? 0
		});
	}
	if (reaction.type === CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT) {
		const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
		const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
		if (apartment) {
			return i18n.t(apartment.isRented
				? "commands:report.city.homes.apartmentNotary.ownedLineRented"
				: "commands:report.city.homes.apartmentNotary.ownedLineEmpty", {
				mapLocationId: apartment.mapLocationId,
				rent: apartment.accumulatedRent
			});
		}
	}
	if (item) {
		switch (reaction.type) {
			case CITY_REACTION_KINDS.ENCHANT:
				return snapshot?.enchanter
					? `${AppIcons.getIcon(`enchantmentTypes.${snapshot.enchanter.enchantmentType}`)} ${i18n.t(`items:enchantments.${snapshot.enchanter.enchantmentId}`)} · ${formatMoney(snapshot.enchanter.enchantmentCost.money)} et ${snapshot.enchanter.enchantmentCost.gems} ${AppIcons.getIcon("unitValues.gem")}`
					: undefined;
			case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE: {
				const upgrade = snapshot?.blacksmith?.upgradeableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
				if (!upgrade) return undefined;
				const missingMaterials = !upgrade.hasAllMaterials && reaction.data.buyMaterials
					? i18n.t("app:city.summary.missingMaterials", {price: formatMoney(upgrade.missingMaterialsCost)}) : "";
				return i18n.t("app:city.subtitles.upgradeDetails", {from: item.itemLevel, to: upgrade.nextLevel, materials: materialSummary(upgrade.materials), missingMaterials});
			}
			case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT: {
				const disenchant = snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
				return disenchant ? i18n.t("app:city.subtitles.disenchantDetails", {
					enchantment: `${AppIcons.getIcon(`enchantmentTypes.${disenchant.enchantmentType}`)} ${i18n.t(`items:enchantments.${disenchant.enchantmentId}`)}`
				}) : undefined;
			}
			case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE: {
				const recycle = snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
				return recycle ? i18n.t("app:city.subtitles.recycleDetails", {
					materials: recycle.recoveredMaterials.map(material => `${material.quantity} × ${i18n.t(`models:materials.${material.materialId}`)}`).join(", ")
				}) : undefined;
			}
			case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
				const upgrade = snapshot?.royalBlacksmith?.upgradeableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
				if (!upgrade) return undefined;
				const missingMaterials = !upgrade.hasAllMaterials && reaction.data.buyMaterials
					? i18n.t("app:city.summary.missingMaterials", {price: formatMoney(upgrade.missingMaterialsCost)}) : "";
				return i18n.t("app:city.subtitles.upgradeDetails", {from: item.itemLevel, to: upgrade.nextLevel, materials: materialSummary(upgrade.materials), missingMaterials});
			}
			default:
				break;
		}
	}
	const key = CITY_SUBTITLE_KEYS[reaction.type];
	return key ? compactCityDescription(i18n.t(key)) : undefined;
}

// @codescene(disable:"Complex Method")
export function cityRowEnd(reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined, item?: CityMobileItem): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.INN_MEAL:
		case CITY_REACTION_KINDS.INN_ROOM:
			return formatMoney(reaction.data.price);
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE: {
			const upgrade = item && (reaction.type === CITY_REACTION_KINDS.BLACKSMITH_UPGRADE
				? snapshot?.blacksmith?.upgradeableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory)
				: snapshot?.royalBlacksmith?.upgradeableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory));
			return upgrade ? formatMoney(upgrade.upgradeCost) : undefined;
		}
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT: {
			const disenchant = item && snapshot?.blacksmith?.disenchantableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
			return disenchant ? formatMoney(disenchant.disenchantCost) : undefined;
		}
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE: {
			const recycle = item && snapshot?.scrapDealer?.recyclableItems.find(candidate => candidate.itemId === item.itemId && candidate.itemCategory === item.itemCategory);
			return recycle && recycle.recoveredMoney > 0 ? formatMoney(recycle.recoveredMoney) : undefined;
		}
		case CITY_REACTION_KINDS.BUY_HOME:
			return snapshot?.home?.manage?.newPrice === undefined ? undefined : formatMoney(snapshot.home.manage.newPrice);
		case CITY_REACTION_KINDS.UPGRADE_HOME:
			return snapshot?.home?.manage?.upgradePrice === undefined ? undefined : formatMoney(snapshot.home.manage.upgradePrice);
		case CITY_REACTION_KINDS.MOVE_HOME:
			return snapshot?.home?.manage?.movePrice === undefined ? undefined : formatMoney(snapshot.home.manage.movePrice);
		case CITY_REACTION_KINDS.APARTMENT_BUY:
			return snapshot?.apartmentNotary?.forSale ? formatMoney(snapshot.apartmentNotary.forSale.price) : undefined;
		case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT: {
			const apartmentId = (reaction.data as {apartmentId?: number}).apartmentId;
			const apartment = snapshot?.apartmentNotary?.ownedApartments.find(candidate => candidate.apartmentId === apartmentId);
			return apartment && apartment.accumulatedRent > 0 ? formatMoney(apartment.accumulatedRent) : undefined;
		}
		default:
			return undefined;
	}
}
