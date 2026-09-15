import { OwnedPet } from "./OwnedPet";
import {
	BuildingUpgradeEligibilityMap, DepositTierAffordability
} from "./GuildDomainEligibility";

export type GuildFoodShopSnapshot = {
	guildName: string;
	food: {
		common: number; carnivorous: number; herbivorous: number; ultimate: number;
	};
	foodCaps: readonly number[];
	maxBuyableFood: readonly number[];
	foodPrices: readonly number[];
	maxFoodCosts: readonly number[];
	playerMoney: number;
	treasury: number;
	canUseShop: boolean;
};
export type GuildDepositOffer = {
	amount: number; treasuryDeposited: number; canAfford: boolean;
};
export type GuildDomainPet = OwnedPet & { petEntityId: number };

export type GuildDomainSnapshot = GuildFoodShopSnapshot & {
	isInCity: boolean;
	domainCityId: string | null;
	domainMapLocationId?: number;
	shopLevel: number;
	shelterLevel: number;
	pantryLevel: number;
	trainingGroundLevel: number;
	guildLevel: number;
	isChief: boolean;
	isElder: boolean;
	shelterPets: GuildDomainPet[];
	shelterMaxCount: number;
	canUpgradeBuildings: BuildingUpgradeEligibilityMap;
	canDeposit: DepositTierAffordability;
	depositOffers: GuildDepositOffer[];
	dailyFoodProduction: readonly number[];
	dailyLovePoints: number;
};
