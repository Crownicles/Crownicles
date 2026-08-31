import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {CITY_DATA_KINDS, CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction} from "ws-packets/src/fromServer/collectors";
import {reactionLabel} from "@/src/collectors/CollectorLabels";
import {cityItemName, itemSnapshotForReaction} from "@/src/collectors/CityItemPresentation";
import {i18n} from "@/src/translations/i18n";

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
