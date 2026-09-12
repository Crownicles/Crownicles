import {
	GuildBuilding, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import { BuildingUpgradeEligibilityMap } from "../../../../Lib/src/types/GuildDomainEligibility";
import {
	GuildDepositOffer, GuildDomainSnapshot, GuildFoodShopSnapshot
} from "../../../../Lib/src/types/GuildDomainSnapshot";
import { Player } from "../database/game/models/Player";
import { Guild } from "../database/game/models/Guild";
import { GuildPets } from "../database/game/models/GuildPet";
import { PetEntities } from "../database/game/models/PetEntity";
import { CityDataController } from "../../data/City";

const BUILDING_LEVEL_FIELDS = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
} as const;

export function buildCanUpgradeBuildings(guild: Guild): BuildingUpgradeEligibilityMap {
	const result = {} as BuildingUpgradeEligibilityMap;
	for (const building of Object.values(GuildBuilding)) {
		const level = guild[BUILDING_LEVEL_FIELDS[building]];
		const cost = GuildDomainConstants.getBuildingUpgradeCost(building, level);
		if (cost === null) {
			result[building] = null;
			continue;
		}
		const requiredGuildLevel = GuildDomainConstants.getBuildingRequiredGuildLevel(building, level) ?? 0;
		result[building] = {
			cost, requiredGuildLevel, canAfford: guild.treasury >= cost, meetsLevel: guild.level >= requiredGuildLevel
		};
	}
	return result;
}

export function buildGuildFoodShopSnapshot(player: Player, guild: Guild): GuildFoodShopSnapshot {
	const food = {
		common: guild.commonFood, carnivorous: guild.carnivorousFood, herbivorous: guild.herbivorousFood, ultimate: guild.ultimateFood
	};
	const foodCaps = GuildDomainConstants.getFoodCaps(guild.pantryLevel);
	const maxBuyableFood = GuildDomainConstants.getMaxBuyableFood(guild.treasury, [
		food.common,
		food.herbivorous,
		food.carnivorous,
		food.ultimate
	], foodCaps);
	return {
		guildName: guild.name,
		food,
		foodCaps,
		maxBuyableFood,
		foodPrices: GuildDomainConstants.SHOP_PRICES.FOOD,
		maxFoodCosts: maxBuyableFood.map((quantity, index) => quantity * GuildDomainConstants.SHOP_PRICES.FOOD[index]),
		playerMoney: player.money,
		treasury: guild.treasury,
		canUseShop: player.insideCity && guild.shopLevel > 0
	};
}

export function buildGuildDepositOffers(player: Player): GuildDepositOffer[] {
	return [
		...new Set([
			GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT,
			GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT,
			GuildDomainConstants.SHOP_PRICES.HUGE_DEPOSIT,
			player.money
		])
	].filter(amount => amount > 0).map(amount => ({
		amount, treasuryDeposited: GuildDomainConstants.computeTreasuryGain(amount), canAfford: player.money >= amount
	}));
}

export async function buildGuildDomainSnapshot(player: Player, guild: Guild): Promise<GuildDomainSnapshot> {
	const shelterEntries = await GuildPets.getOfGuild(guild.id);
	const shelterPets = await Promise.all(shelterEntries.map(entry => PetEntities.getById(entry.petEntityId)));
	const domainMapLocationId = guild.domainCityId ? CityDataController.instance.getById(guild.domainCityId)?.maps[0] : undefined;
	return {
		...buildGuildFoodShopSnapshot(player, guild),
		isInCity: player.insideCity && player.getCurrentCityId() === guild.domainCityId,
		domainCityId: guild.domainCityId,
		...domainMapLocationId === undefined ? {} : { domainMapLocationId },
		shopLevel: guild.shopLevel,
		shelterLevel: guild.shelterLevel,
		pantryLevel: guild.pantryLevel,
		trainingGroundLevel: guild.trainingGroundLevel,
		guildLevel: guild.level,
		isChief: guild.chiefId === player.id,
		isElder: guild.elderId === player.id,
		shelterPets: shelterPets.filter(pet => pet !== null).map(pet => ({
			...pet.asOwnedPet(), petEntityId: pet.id
		})),
		shelterMaxCount: GuildDomainConstants.getShelterSlots(guild.shelterLevel),
		canUpgradeBuildings: buildCanUpgradeBuildings(guild),
		canDeposit: {
			small: player.money >= GuildDomainConstants.SHOP_PRICES.SMALL_DEPOSIT,
			big: player.money >= GuildDomainConstants.SHOP_PRICES.BIG_DEPOSIT,
			huge: player.money >= GuildDomainConstants.SHOP_PRICES.HUGE_DEPOSIT
		},
		depositOffers: buildGuildDepositOffers(player),
		dailyFoodProduction: GuildDomainConstants.getAutoFillRates(guild.pantryLevel),
		dailyLovePoints: GuildDomainConstants.getTrainingLovePerDay(guild.trainingGroundLevel)
	};
}
