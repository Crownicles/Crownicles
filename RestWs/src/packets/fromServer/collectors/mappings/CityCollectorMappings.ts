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
import type {
	CityMobileDisenchantItem,
	CityMobileItem,
	CityMobileRecycleItem,
	CityMobileSnapshot,
	CityMobileUpgradeItem
} from "../../../../../../WsPackets/src/fromServer/collectors/families/CityCollectors";
import {
	DataMapping,
	defineDataMapping,
	defineReactionMapping,
	ReactionMapping
} from "../CollectorMapping";

function itemSnapshot(item: {
	slot: number;
	category: number;
	details: {
		id: number; itemLevel: number;
	};
}): CityMobileItem {
	return {
		slot: item.slot,
		itemId: item.details.id,
		itemCategory: item.category,
		itemLevel: item.details.itemLevel
	};
}

function upgradeItemSnapshot(item: {
	category: number;
	slot: number;
	details: {
		id: number; itemLevel: number;
	};
	nextLevel?: number;
	upgradeCost: number;
	missingMaterialsCost: number;
	hasAllMaterials: boolean;
	canUpgrade: boolean;
	canBuyAndUpgrade: boolean;
	requiredMaterials: {
		materialId: number; quantity: number; playerQuantity: number;
	}[];
}): CityMobileUpgradeItem {
	return {
		...itemSnapshot(item),
		nextLevel: item.nextLevel ?? item.details.itemLevel + 1,
		upgradeCost: item.upgradeCost,
		missingMaterialsCost: item.missingMaterialsCost,
		hasAllMaterials: item.hasAllMaterials,
		canUpgrade: item.canUpgrade,
		canBuyAndUpgrade: item.canBuyAndUpgrade,
		materials: item.requiredMaterials.map(material => ({ ...material }))
	};
}

// @codescene(disable:"Complex Method")
function mapCitySnapshot(data: ReactionCollectorCityData): CityMobileSnapshot {
	const ownedHome = data.home.owned;
	const manage = data.home.manage;
	const snapshot: CityMobileSnapshot = {
		energy: data.energy,
		health: data.health,
		inns: data.inns?.map(inn => ({ innId: inn.innId })),
		shops: data.shops?.map(shop => ({
			shopId: shop.shopId, isEmpty: Boolean(shop.isEmpty)
		})),
		otherCityServices: data.otherCityServices?.map(service => ({ ...service })),
		home: {
			owned: ownedHome
				? {
					level: ownedHome.level,
					...ownedHome.isApartment === undefined ? {} : { isApartment: ownedHome.isApartment },
					cookingLevel: ownedHome.cooking.level,
					cookingSlots: ownedHome.features.cookingSlots,
					bedHealthRegeneration: ownedHome.features.bedHealthRegeneration,
					gardenPlots: ownedHome.features.gardenPlots,
					hasBed: ownedHome.features.bedHealthRegeneration > 0,
					hasChest: ownedHome.features.chestSlots.weapon + ownedHome.features.chestSlots.armor
					+ ownedHome.features.chestSlots.object + ownedHome.features.chestSlots.potion > 0,
					hasGarden: ownedHome.features.gardenPlots > 0,
					hasCooking: ownedHome.features.cookingSlots > 0,
					hasUpgradeStation: ownedHome.upgradeStation !== undefined,
					upgradeableItemCount: ownedHome.upgradeStation?.upgradeableItems.length ?? 0,
					...ownedHome.chest === undefined
						? {}
						: {
							chestItemCount: ownedHome.chest.chestItems.length,
							depositableItemCount: ownedHome.chest.depositableItems.length
						},
					...ownedHome.garden === undefined
						? {}
						: {
							gardenReadyPlots: ownedHome.garden.plots.filter(plot => plot.isReady).length,
							gardenTotalPlots: ownedHome.garden.totalPlots,
							garden: {
								plots: ownedHome.garden.plots.map(plot => ({
									slot: plot.slot,
									plantId: plot.plantId,
									growthProgress: plot.growthProgress,
									isReady: plot.isReady,
									readyAtTimestamp: plot.readyAtTimestamp
								})),
								hasSeed: ownedHome.garden.hasSeed,
								seedPlantId: ownedHome.garden.seedPlantId,
								eligibility: { ...ownedHome.garden.eligibility }
							}
						}
				}
				: undefined,
			manage: manage
				? {
					...manage.newPrice === undefined ? {} : { newPrice: manage.newPrice },
					...manage.upgrade === undefined ? {} : { upgradePrice: manage.upgrade.price },
					...manage.movePrice === undefined ? {} : { movePrice: manage.movePrice },
					currentMoney: manage.currentMoney,
					...manage.canBuy === undefined ? {} : { canBuy: manage.canBuy },
					...manage.canUpgrade === undefined ? {} : { canUpgrade: manage.canUpgrade },
					...manage.canMove === undefined ? {} : { canMove: manage.canMove }
				}
				: undefined
		}
	};

	if (data.enchanter) {
		snapshot.enchanter = {
			enchantmentId: data.enchanter.enchantmentId,
			enchantmentType: data.enchanter.enchantmentType,
			enchantmentSlot: data.enchanter.enchantmentSlot,
			enchantmentCost: { ...data.enchanter.enchantmentCost },
			mageReduction: data.enchanter.mageReduction,
			playerMoney: data.enchanter.playerMoney,
			playerGems: data.enchanter.playerGems,
			enchantableItems: data.enchanter.enchantableItems.map(item => itemSnapshot(item))
		};
	}

	if (data.blacksmith) {
		snapshot.blacksmith = {
			playerMoney: data.blacksmith.playerMoney,
			upgradeableItems: data.blacksmith.upgradeableItems.map(upgradeItemSnapshot),
			disenchantableItems: data.blacksmith.disenchantableItems.map(item => ({
				...itemSnapshot(item),
				enchantmentId: item.enchantmentId,
				enchantmentType: item.enchantmentType,
				disenchantCost: item.disenchantCost,
				canDisenchant: item.canDisenchant
			} satisfies CityMobileDisenchantItem))
		};
	}

	if (data.scrapDealer) {
		snapshot.scrapDealer = {
			recyclableItems: data.scrapDealer.recyclableItems.map(item => ({
				...itemSnapshot(item),
				recoveredMaterials: item.recoveredMaterials.map(material => ({ ...material })),
				recoveredMoney: item.recoveredMoney
			} satisfies CityMobileRecycleItem))
		};
	}

	if (data.royalBlacksmith) {
		snapshot.royalBlacksmith = {
			status: data.royalBlacksmith.status,
			playerLevel: data.royalBlacksmith.playerLevel,
			requiredPlayerLevel: data.royalBlacksmith.requiredPlayerLevel,
			playerMoney: data.royalBlacksmith.playerMoney,
			playerGems: data.royalBlacksmith.playerGems,
			upgradeableItems: data.royalBlacksmith.upgradeableItems.map(upgradeItemSnapshot)
		};
	}

	if (data.guildDomain) {
		snapshot.guildDomain = {
			guildName: data.guildDomain.guildName,
			shopLevel: data.guildDomain.shopLevel,
			shelterLevel: data.guildDomain.shelterLevel,
			pantryLevel: data.guildDomain.pantryLevel,
			trainingGroundLevel: data.guildDomain.trainingGroundLevel,
			shelterMaxCount: data.guildDomain.shelterMaxCount,
			guildLevel: data.guildDomain.guildLevel,
			treasury: data.guildDomain.treasury,
			playerMoney: data.guildDomain.playerMoney,
			food: { ...data.guildDomain.food }
		};
	}
	if (data.guildDomainNotary) {
		snapshot.guildDomainNotary = {
			hasDomain: data.guildDomainNotary.hasDomain,
			cost: data.guildDomainNotary.cost,
			treasury: data.guildDomainNotary.treasury,
			canAfford: data.guildDomainNotary.canAfford
		};
	}
	if (data.guildFoodShop) {
		snapshot.guildFoodShop = {
			guildName: data.guildFoodShop.guildName,
			playerMoney: data.guildFoodShop.playerMoney,
			treasury: data.guildFoodShop.treasury
		};
	}
	snapshot.apartmentNotary = {
		...data.apartmentNotary.forSale === undefined
			? {}
			: {
				forSale: {
					price: data.apartmentNotary.forSale.price,
					canAfford: data.apartmentNotary.forSale.canAfford,
					...data.apartmentNotary.forSale.canAfford ? {} : { missingMoney: data.apartmentNotary.forSale.missingMoney }
				}
			},
		ownedApartments: data.apartmentNotary.ownedApartments.map(apartment => ({
			apartmentId: apartment.apartmentId,
			mapLocationId: apartment.mapLocationId,
			accumulatedRent: apartment.accumulatedRent,
			isRented: apartment.isRented,
			canClaim: apartment.canClaim
		})),
		ownedCount: data.apartmentNotary.ownedApartments.length,
		accumulatedRent: data.apartmentNotary.ownedApartments.reduce((total, apartment) => total + apartment.accumulatedRent, 0)
	};
	return snapshot;
}

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
		snapshot: mapCitySnapshot(data),
		...data.initialMenu === undefined ? {} : { initialMenu: data.initialMenu },
		...data.gardenOnly === undefined ? {} : { gardenOnly: data.gardenOnly }
	}))
];
