import { OwnedPet } from "./OwnedPet";
import { PetFood } from "./PetFood";

export enum GuildBuilding {
	SHOP = "shop",
	SHELTER = "shelter",
	PANTRY = "pantry",
	TRAINING_GROUND = "trainingGround"
}

export const GUILD_DOMAIN_ERRORS = {
	NO_GUILD: "noGuild",
	NO_DOMAIN: "noDomain",
	NO_SHOP: "noShop",
	NOT_AUTHORIZED: "notAuthorized",
	INVALID_BUILDING: "invalidBuilding",
	MAX_LEVEL: "maxLevel",
	GUILD_LEVEL_TOO_LOW: "guildLevelTooLow",
	NOT_ENOUGH_TREASURY: "notEnoughTreasury",
	NOT_ENOUGH_MONEY: "notEnoughMoney",
	INVALID_TIER: "invalidTier",
	INVALID_AMOUNT: "invalidAmount",
	INVALID_FOOD: "invalidFood",
	STORAGE_FULL: "storageFull",
	CANNOT_BUY: "cannotBuy"
} as const;
export type GuildDomainError = typeof GUILD_DOMAIN_ERRORS[keyof typeof GUILD_DOMAIN_ERRORS];
export type BuildingUpgradeEligibility = {
	canAfford: boolean; meetsLevel: boolean; cost: number; requiredGuildLevel: number;
};
export type GuildFoodStock = {
	common: number; carnivorous: number; herbivorous: number; ultimate: number;
};
export type GuildFoodShop = {
	guildName: string;
	playerMoney: number;
	treasury: number;
	food: GuildFoodStock;
	foodCaps: readonly number[];
	maxBuyableFood: readonly number[];
	foodPrices: readonly number[];
	maxFoodCosts: readonly number[];
	canUseShop: boolean;
};
export type GuildDepositOffer = {
	amount: number; treasuryDeposited: number; canAfford: boolean;
};
export type GuildDomainSnapshot = GuildFoodShop & {
	isInCity: boolean;
	isChief: boolean;
	isElder: boolean;
	domainCityId: string | null;
	domainMapLocationId?: number;
	shopLevel: number;
	shelterLevel: number;
	pantryLevel: number;
	trainingGroundLevel: number;
	shelterMaxCount: number;
	guildLevel: number;
	shelterPets: OwnedPet[];
	canUpgradeBuildings: Record<GuildBuilding, BuildingUpgradeEligibility | null>;
	canDeposit: {
		small: boolean; big: boolean; huge: boolean;
	};
	depositOffers: GuildDepositOffer[];
	dailyFoodProduction: readonly number[];
	dailyLovePoints: number;
};
export type GuildDomainOutcome =
	| {
		type: "notary"; relocated: boolean; cost: number;
	}
	| {
		type: "treasuryMissing"; missingTreasury: number;
	}
	| {
		type: "upgrade"; building: GuildBuilding; newLevel: number; cost: number; newTreasury: number; xpGained: number;
	}
	| {
		type: "food"; foodType: PetFood; newFoodStock: number; newTreasury: number; amountBought: number; totalCost: number;
	}
	| {
		type: "deposit"; treasuryDeposited: number; newPlayerMoney: number; newTreasury: number;
	}
	| {
		type: "error"; error: GuildDomainError;
	};
