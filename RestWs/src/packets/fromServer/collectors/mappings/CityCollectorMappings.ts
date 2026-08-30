import {
	ReactionCollectorApartmentBuyReaction,
	ReactionCollectorApartmentClaimRentReaction,
	ReactionCollectorBlacksmithDisenchantReaction,
	ReactionCollectorBlacksmithMenuReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityShopReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorEnchantReaction,
	ReactionCollectorExitCityReaction,
	ReactionCollectorGardenCompostReaction,
	ReactionCollectorGardenHarvestReaction,
	ReactionCollectorGardenWaterReaction,
	ReactionCollectorGuildDomainMenuReaction,
	ReactionCollectorGuildDomainNotaryReaction,
	ReactionCollectorHomeBedReaction,
	ReactionCollectorHomeMenuReaction,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction,
	ReactionCollectorRoyalBlacksmithMenuReaction,
	ReactionCollectorRoyalBlacksmithUpgradeReaction,
	ReactionCollectorScrapDealerMenuReaction,
	ReactionCollectorScrapDealerRecycleReaction,
	ReactionCollectorUpgradeItemReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CITY_DATA_KINDS,
	CITY_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping,
	defineDataMapping,
	defineReactionMapping,
	ReactionMapping
} from "../CollectorMapping";

export const cityReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorExitCityReaction, CITY_REACTION_KINDS.EXIT, () => ({})),
	defineReactionMapping(ReactionCollectorInnMealReaction, CITY_REACTION_KINDS.INN_MEAL, reaction => ({
		innId: reaction.innId,
		mealId: reaction.meal.mealId,
		price: reaction.meal.price,
		energy: reaction.meal.energy
	})),
	defineReactionMapping(ReactionCollectorInnRoomReaction, CITY_REACTION_KINDS.INN_ROOM, reaction => ({
		innId: reaction.innId,
		roomId: reaction.room.roomId,
		price: reaction.room.price,
		health: reaction.room.health
	})),
	defineReactionMapping(ReactionCollectorEnchantReaction, CITY_REACTION_KINDS.ENCHANT, reaction => ({
		slot: reaction.slot, itemCategory: reaction.itemCategory
	})),
	defineReactionMapping(ReactionCollectorCityShopReaction, CITY_REACTION_KINDS.SHOP, reaction => ({ shopId: reaction.shopId })),
	defineReactionMapping(ReactionCollectorCityBuyHomeReaction, CITY_REACTION_KINDS.BUY_HOME, () => ({})),
	defineReactionMapping(ReactionCollectorCityUpgradeHomeReaction, CITY_REACTION_KINDS.UPGRADE_HOME, () => ({})),
	defineReactionMapping(ReactionCollectorCityMoveHomeReaction, CITY_REACTION_KINDS.MOVE_HOME, () => ({})),
	defineReactionMapping(ReactionCollectorHomeMenuReaction, CITY_REACTION_KINDS.HOME_MENU, () => ({})),
	defineReactionMapping(ReactionCollectorHomeBedReaction, CITY_REACTION_KINDS.HOME_BED, () => ({})),
	defineReactionMapping(ReactionCollectorUpgradeItemReaction, CITY_REACTION_KINDS.UPGRADE_ITEM, reaction => ({
		slot: reaction.slot, itemCategory: reaction.itemCategory
	})),
	defineReactionMapping(ReactionCollectorBlacksmithMenuReaction, CITY_REACTION_KINDS.BLACKSMITH_MENU, () => ({})),
	defineReactionMapping(ReactionCollectorBlacksmithUpgradeReaction, CITY_REACTION_KINDS.BLACKSMITH_UPGRADE, reaction => ({
		slot: reaction.slot,
		itemCategory: reaction.itemCategory,
		buyMaterials: reaction.buyMaterials
	})),
	defineReactionMapping(ReactionCollectorBlacksmithDisenchantReaction, CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT, reaction => ({
		slot: reaction.slot, itemCategory: reaction.itemCategory
	})),
	defineReactionMapping(ReactionCollectorScrapDealerMenuReaction, CITY_REACTION_KINDS.SCRAP_DEALER_MENU, () => ({})),
	defineReactionMapping(ReactionCollectorScrapDealerRecycleReaction, CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE, reaction => ({
		slot: reaction.slot,
		itemCategory: reaction.itemCategory,
		itemId: reaction.itemId
	})),
	defineReactionMapping(ReactionCollectorRoyalBlacksmithMenuReaction, CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU, () => ({})),
	defineReactionMapping(ReactionCollectorRoyalBlacksmithUpgradeReaction, CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE, reaction => ({
		slot: reaction.slot,
		itemCategory: reaction.itemCategory,
		buyMaterials: reaction.buyMaterials
	})),
	defineReactionMapping(ReactionCollectorGardenHarvestReaction, CITY_REACTION_KINDS.GARDEN_HARVEST, () => ({})),
	defineReactionMapping(ReactionCollectorGardenWaterReaction, CITY_REACTION_KINDS.GARDEN_WATER, () => ({})),
	defineReactionMapping(ReactionCollectorGardenCompostReaction, CITY_REACTION_KINDS.GARDEN_COMPOST, reaction => ({
		plantId: reaction.plantId, quantity: reaction.quantity
	})),
	defineReactionMapping(ReactionCollectorGuildDomainMenuReaction, CITY_REACTION_KINDS.GUILD_DOMAIN_MENU, () => ({})),
	defineReactionMapping(ReactionCollectorGuildDomainNotaryReaction, CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY, () => ({})),
	defineReactionMapping(ReactionCollectorApartmentBuyReaction, CITY_REACTION_KINDS.APARTMENT_BUY, () => ({})),
	defineReactionMapping(ReactionCollectorApartmentClaimRentReaction, CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT, reaction => ({ apartmentId: reaction.apartmentId }))
];

export const cityDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorCityData, CITY_DATA_KINDS.CITY, data => ({
		mapTypeId: data.mapTypeId,
		mapLocationId: data.mapLocationId,
		availableServices: [...data.availableServices],
		...data.initialMenu === undefined ? {} : { initialMenu: data.initialMenu },
		...data.gardenOnly === undefined ? {} : { gardenOnly: data.gardenOnly }
	}))
];
