import {
	ReactionCollectorDataKind,
	ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

/**
 * Data needed to render the mobile city screens without leaking the complete server-side models.
 * Reactions remain the source of truth for actions; this snapshot is display-only.
 */
export type CityMobileSnapshot = {
	energy?: {
		current: number; max: number;
	};
	health?: {
		current: number; max: number;
	};
	inns?: { innId: string }[];
	shops?: {
		shopId: string; isEmpty: boolean;
	}[];
	otherCityServices?: {
		mapLocationId: number; mapLocationIds?: number[]; serviceKey: string; kind: "service" | "shop";
	}[];
	home?: {
		owned?: {
			level: number;
			isApartment?: boolean;
			cookingLevel?: number;
			cookingSlots?: number;
			bedHealthRegeneration: number;
			gardenPlots: number;
			hasBed: boolean;
			hasChest: boolean;
			hasGarden: boolean;
			hasCooking: boolean;
			hasUpgradeStation: boolean;
			upgradeableItemCount: number;
			chestItemCount?: number;
			depositableItemCount?: number;
			gardenReadyPlots?: number;
			gardenTotalPlots?: number;
			garden?: {
				plots: {
					slot: number; plantId: number; growthProgress: number; isReady: boolean; readyAtTimestamp: number;
				}[];
				hasSeed: boolean;
				seedPlantId: number;
				eligibility: {
					canHarvest: boolean; canPlantSeed: boolean; canWaterGarden: boolean; canCompost: boolean;
				};
			};
		};
		manage?: {
			newPrice?: number;
			upgradePrice?: number;
			movePrice?: number;
			currentMoney: number;
			canBuy?: boolean;
			canUpgrade?: boolean;
			canMove?: boolean;
		};
	};
	enchanter?: {
		enchantmentId: string;
		enchantmentType: string;
		enchantmentSlot: number;
		enchantmentCost: {
			money: number; gems: number;
		};
		mageReduction: boolean;
		playerMoney: number;
		playerGems: number;
		enchantableItems: CityMobileItem[];
	};
	blacksmith?: {
		playerMoney: number;
		upgradeableItems: CityMobileUpgradeItem[];
		disenchantableItems: CityMobileDisenchantItem[];
	};
	scrapDealer?: {
		recyclableItems: CityMobileRecycleItem[];
	};
	royalBlacksmith?: {
		status: string;
		playerLevel: number;
		requiredPlayerLevel: number;
		playerMoney: number;
		playerGems: number;
		upgradeableItems: CityMobileUpgradeItem[];
	};
	guildDomain?: {
		guildName: string;
		shopLevel: number;
		shelterLevel: number;
		pantryLevel: number;
		trainingGroundLevel: number;
		shelterMaxCount: number;
		guildLevel: number;
		treasury: number;
		playerMoney: number;
		food: {
			common: number; carnivorous: number; herbivorous: number; ultimate: number;
		};
	};
	guildDomainNotary?: {
		hasDomain: boolean;
		cost: number;
		treasury: number;
		canAfford: boolean;
	};
	guildFoodShop?: {
		guildName: string;
		playerMoney: number;
		treasury: number;
	};
	apartmentNotary?: {
		forSale?: {
			price: number; canAfford: boolean; missingMoney?: number;
		};
		ownedApartments: {
			apartmentId: number;
			mapLocationId: number;
			accumulatedRent: number;
			isRented: boolean;
			canClaim: boolean;
		}[];
		ownedCount: number;
		accumulatedRent: number;
	};
};

export type CityMobileItem = {
	slot: number;
	itemId: number;
	itemCategory: number;
	itemLevel: number;
};

export type CityMobileUpgradeItem = CityMobileItem & {
	nextLevel: number;
	upgradeCost: number;
	missingMaterialsCost: number;
	hasAllMaterials: boolean;
	canUpgrade: boolean;
	canBuyAndUpgrade: boolean;
	materials: {
		materialId: number; quantity: number; playerQuantity: number;
	}[];
};

export type CityMobileDisenchantItem = CityMobileItem & {
	enchantmentId: string;
	enchantmentType: string;
	disenchantCost: number;
	canDisenchant: boolean;
};

export type CityMobileRecycleItem = CityMobileItem & {
	recoveredMaterials: {
		materialId: number; quantity: number;
	}[];
	recoveredMoney: number;
};

/**
 * The city collector keeps actions in the ordered reaction list and carries a compact display
 * snapshot for the mobile menu. The snapshot never authorises an action; Core remains authoritative.
 */
declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		city: {
			mapTypeId: string;
			mapLocationId: number;
			availableServices: string[];
			initialMenu?: string;
			gardenOnly?: boolean;
			snapshot?: CityMobileSnapshot;
		};
	}

	interface ReactionCollectorReactionPayloads {
		cityExit: Record<string, never>;
		cityInnMeal: {
			innId: string;
			mealId: string;
			price: number;
			energy: number;
		};
		cityInnRoom: {
			innId: string;
			roomId: string;
			price: number;
			health: number;
		};
		cityEnchant: {
			slot: number;
			itemCategory: number;
		};
		cityShop: {
			shopId: string;
		};
		cityBuyHome: Record<string, never>;
		cityUpgradeHome: Record<string, never>;
		cityMoveHome: Record<string, never>;
		homeMenu: Record<string, never>;
		homeBed: Record<string, never>;
		cityUpgradeItem: {
			slot: number;
			itemCategory: number;
		};
		cityBlacksmithMenu: Record<string, never>;
		cityBlacksmithUpgrade: {
			slot: number;
			itemCategory: number;
			buyMaterials: boolean;
		};
		cityBlacksmithDisenchant: {
			slot: number;
			itemCategory: number;
		};
		cityScrapDealerMenu: Record<string, never>;
		cityScrapDealerRecycle: {
			slot: number;
			itemCategory: number;
			itemId: number;
		};
		cityRoyalBlacksmithMenu: Record<string, never>;
		cityRoyalBlacksmithUpgrade: {
			slot: number;
			itemCategory: number;
			buyMaterials: boolean;
		};
		cityGardenHarvest: Record<string, never>;
		cityGardenWater: Record<string, never>;
		cityGardenCompost: {
			plantId: number;
			quantity: number;
		};
		cityGuildDomainMenu: Record<string, never>;
		cityGuildDomainNotary: Record<string, never>;
		cityApartmentBuy: Record<string, never>;
		cityApartmentClaimRent: {
			apartmentId: number;
		};
	}
}

export const CITY_DATA_KINDS = {
	CITY: "city"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const CITY_REACTION_KINDS = {
	EXIT: "cityExit",
	INN_MEAL: "cityInnMeal",
	INN_ROOM: "cityInnRoom",
	ENCHANT: "cityEnchant",
	SHOP: "cityShop",
	BUY_HOME: "cityBuyHome",
	UPGRADE_HOME: "cityUpgradeHome",
	MOVE_HOME: "cityMoveHome",
	HOME_MENU: "homeMenu",
	HOME_BED: "homeBed",
	UPGRADE_ITEM: "cityUpgradeItem",
	BLACKSMITH_MENU: "cityBlacksmithMenu",
	BLACKSMITH_UPGRADE: "cityBlacksmithUpgrade",
	BLACKSMITH_DISENCHANT: "cityBlacksmithDisenchant",
	SCRAP_DEALER_MENU: "cityScrapDealerMenu",
	SCRAP_DEALER_RECYCLE: "cityScrapDealerRecycle",
	ROYAL_BLACKSMITH_MENU: "cityRoyalBlacksmithMenu",
	ROYAL_BLACKSMITH_UPGRADE: "cityRoyalBlacksmithUpgrade",
	GARDEN_HARVEST: "cityGardenHarvest",
	GARDEN_WATER: "cityGardenWater",
	GARDEN_COMPOST: "cityGardenCompost",
	GUILD_DOMAIN_MENU: "cityGuildDomainMenu",
	GUILD_DOMAIN_NOTARY: "cityGuildDomainNotary",
	APARTMENT_BUY: "cityApartmentBuy",
	APARTMENT_CLAIM_RENT: "cityApartmentClaimRent"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
