import {
	ReactionCollectorDataKind,
	ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

/**
 * The city collector deliberately keeps the wire payload focused on the menu. Detailed service
 * snapshots stay owned by their respective commands; the city screen only needs the location and
 * the reactions that Core already computed for this visit.
 */
declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		city: {
			mapTypeId: string;
			mapLocationId: number;
			availableServices: string[];
			initialMenu?: string;
			gardenOnly?: boolean;
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
