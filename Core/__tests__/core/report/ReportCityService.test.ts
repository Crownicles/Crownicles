import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getHomesCount: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Apartment", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Apartment")>(),
	Apartments: {
		getOfPlayer: vi.fn(), getOfPlayerInCity: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/HomeChestSlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/HomeChestSlot")>(),
	HomeChestSlots: {
		ensureSlotsForLevel: vi.fn(), getOfHome: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/HomePlantStorage", () => ({
	HomePlantStorages: { getOfHome: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerPlantSlot", () => ({
	PlayerPlantSlots: {
		ensureSlotsForCount: vi.fn(), getPlantSlots: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/report/ReportGardenService", () => ({
	buildGardenData: vi.fn()
}));

import {
	buildApartmentNotaryData, buildChestData, buildEnchanterData, buildHomeData, buildUpgradeStationData
} from "../../../src/core/report/ReportCityService";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import {
	Apartment, Apartments
} from "../../../src/core/database/game/models/Apartment";
import {
	HomeChestSlot, HomeChestSlots
} from "../../../src/core/database/game/models/HomeChestSlot";
import InventoryInfo from "../../../src/core/database/game/models/InventoryInfo";
import { HomePlantStorages } from "../../../src/core/database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { buildGardenData } from "../../../src/core/report/ReportGardenService";
import {
	City, CityDataController
} from "../../../src/data/City";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import { EnchanterTomorrowData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import {
	makeCityPlayer, makeInventorySlot
} from "./CityPlayerFixture";

// Boug Coton: home prices x0.95, apartment for 6000. Ville Forte: home prices x1.01, apartment for 9000
const HOME_CITY_ID = "boug_coton";
const OTHER_CITY_ID = "ville_forte";
const INITIAL_HOME_PRICE = 950;
const LEVEL_2_PRICE = 3325;
const APARTMENT_PRICE = 6000;
const NOW = new Date("2026-11-21T12:00:00Z");

const COMMON_WEAPON_ID = 2;
const RARE_WEAPON_ID = 11;
const COMMON_ARMOR_ID = 2;

function getCity(cityId: string): City {
	const city = CityDataController.instance.getById(cityId);
	if (!city) {
		throw new Error(`Unknown city ${cityId}`);
	}
	return city;
}

function makeHome(cityId: string, level: number): Home {
	return Object.assign(Object.create(Home.prototype) as Home, {
		id: 3, ownerId: 1, cityId, level
	});
}

function makeApartment(cityId: string, rentDays: number, id = 5): Apartment {
	return Object.assign(Object.create(Apartment.prototype) as Apartment, {
		id,
		ownerId: 1,
		cityId,
		purchasePrice: 777,
		lastRentClaimedAt: new Date(NOW.getTime() - rentDays * TimeConstants.MS_TIME.DAY)
	});
}

function makeChestSlot(slot: number, itemId: number): HomeChestSlot {
	return Object.assign(Object.create(HomeChestSlot.prototype) as HomeChestSlot, {
		homeId: 3, slot, itemCategory: ItemCategory.ARMOR, itemId, itemLevel: 0, itemEnchantmentId: null
	});
}

function playerData(money: number, level = 1): Parameters<typeof buildHomeData>[0] {
	return {
		player: makeCityPlayer(money, level), inventory: [], materialMap: new Map()
	};
}

function homeData(home: Home | null): Parameters<typeof buildHomeData>[1] {
	return {
		home, homeLevel: home ? HomeLevel.getByLevel(home.level) : null
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Homes.getHomesCount).mockResolvedValue([]);
	vi.mocked(Apartments.getOfPlayer).mockResolvedValue([]);
	vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(null);
	vi.mocked(HomeChestSlots.getOfHome).mockResolvedValue([]);
	vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue([]);
	vi.mocked(PlayerPlantSlots.getPlantSlots).mockResolvedValue([]);
	vi.spyOn(InventoryInfo, "findOne").mockResolvedValue(null);
});

describe("buildHomeData manage options", () => {
	it("offers a player without home to buy the initial home at the city price", async () => {
		const data = await buildHomeData(playerData(INITIAL_HOME_PRICE), homeData(null), getCity(HOME_CITY_ID));

		expect(data).toEqual({
			manage: {
				newPrice: INITIAL_HOME_PRICE, currentMoney: INITIAL_HOME_PRICE, canBuy: true
			}
		});
	});

	it("does not allow buying the home when one coin is missing", async () => {
		const data = await buildHomeData(playerData(INITIAL_HOME_PRICE - 1), homeData(null), getCity(HOME_CITY_ID));

		expect(data.manage).toEqual({
			newPrice: INITIAL_HOME_PRICE, currentMoney: INITIAL_HOME_PRICE - 1
		});
	});

	it("offers the upgrade of the home of the city at the city price of the next level", async () => {
		const enough = await buildHomeData(playerData(LEVEL_2_PRICE, HomeLevel.LEVEL_2.requiredPlayerLevel), homeData(makeHome(HOME_CITY_ID, 1)), getCity(HOME_CITY_ID));
		const short = await buildHomeData(playerData(LEVEL_2_PRICE - 1, HomeLevel.LEVEL_2.requiredPlayerLevel), homeData(makeHome(HOME_CITY_ID, 1)), getCity(HOME_CITY_ID));

		expect(enough.manage).toEqual({
			upgrade: {
				price: LEVEL_2_PRICE, oldFeatures: HomeLevel.LEVEL_1.features, newFeatures: HomeLevel.LEVEL_2.features
			},
			movePrice: undefined,
			currentMoney: LEVEL_2_PRICE,
			canUpgrade: true
		});
		expect(short.manage?.canUpgrade).toBeUndefined();
	});

	it("tells the player the level required for the next upgrade when he is too low", async () => {
		const data = await buildHomeData(playerData(1_000_000, HomeLevel.LEVEL_2.requiredPlayerLevel - 1), homeData(makeHome(HOME_CITY_ID, 1)), getCity(HOME_CITY_ID));

		expect(data.manage).toEqual({
			currentMoney: 1_000_000, isMaxLevel: false, requiredPlayerLevelForUpgrade: HomeLevel.LEVEL_2.requiredPlayerLevel
		});
	});

	it("tells the player his home is at the maximum level", async () => {
		const data = await buildHomeData(playerData(1_000_000, 1_000), homeData(makeHome(HOME_CITY_ID, 8)), getCity(HOME_CITY_ID));

		expect(data.manage).toEqual({
			currentMoney: 1_000_000, isMaxLevel: true, requiredPlayerLevelForUpgrade: undefined
		});
	});

	it("offers to move a home from another city, cheaper towards the least populated city", async () => {
		const home = makeHome(OTHER_CITY_ID, 1);
		vi.mocked(Homes.getHomesCount).mockResolvedValue([
			{
				cityId: OTHER_CITY_ID, count: 1
			},
			{
				cityId: HOME_CITY_ID, count: 4
			}
		]);
		const crowded = await buildHomeData(playerData(HomeConstants.MOVE_HOME_PRICE_DEFAULT), homeData(home), getCity(HOME_CITY_ID));
		vi.mocked(Homes.getHomesCount).mockResolvedValue([
			{
				cityId: OTHER_CITY_ID, count: 4
			},
			{
				cityId: HOME_CITY_ID, count: 1
			}
		]);
		const empty = await buildHomeData(playerData(HomeConstants.MOVE_HOME_PRICE_LEAST_POPULATED - 1), homeData(home), getCity(HOME_CITY_ID));

		expect(crowded).toEqual({
			manage: {
				upgrade: undefined, movePrice: HomeConstants.MOVE_HOME_PRICE_DEFAULT, currentMoney: HomeConstants.MOVE_HOME_PRICE_DEFAULT, canMove: true
			}
		});
		expect(empty.manage).toEqual({
			upgrade: undefined, movePrice: HomeConstants.MOVE_HOME_PRICE_LEAST_POPULATED, currentMoney: HomeConstants.MOVE_HOME_PRICE_LEAST_POPULATED - 1
		});
	});
});

describe("buildHomeData owned home", () => {
	it("exposes the upgrade station, the chest and the features of the home of the city", async () => {
		const player = playerData(0);
		player.inventory = [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID
			})
		];

		const data = await buildHomeData(player, homeData(makeHome(HOME_CITY_ID, 1)), getCity(HOME_CITY_ID));

		expect(data.owned).toMatchObject({
			level: 1,
			features: HomeLevel.LEVEL_1.features,
			upgradeStation: { maxUpgradeableRarity: HomeLevel.LEVEL_1.features.upgradeItemMaximumRarity }
		});
		expect(data.owned?.upgradeStation?.upgradeableItems.map(item => item.slot)).toEqual([0]);
		expect(data.owned?.chest?.depositableItems.map(item => item.details.id)).toEqual([COMMON_WEAPON_ID]);
		expect(data.owned?.garden).toBeUndefined();
		expect(data.owned?.isApartment).toBeUndefined();
	});

	it("adds the garden of a home having garden plots", async () => {
		const garden = {} as Awaited<ReturnType<typeof buildGardenData>>;
		vi.mocked(buildGardenData).mockResolvedValue(garden);

		const data = await buildHomeData(playerData(0, 1_000), homeData(makeHome(HOME_CITY_ID, 2)), getCity(HOME_CITY_ID));

		expect(data.owned?.garden).toBe(garden);
	});

	it("gives remote access to the chest from an apartment, with the bed capped at the apartment level and no upgrade station nor garden", async () => {
		vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(makeApartment(HOME_CITY_ID, 0));

		const data = await buildHomeData(playerData(0, 1_000), homeData(makeHome(OTHER_CITY_ID, 8)), getCity(HOME_CITY_ID));

		expect(data.owned).toMatchObject({
			level: 8,
			isApartment: true,
			features: {
				...HomeLevel.LEVEL_8.features,
				gardenPlots: 0,
				gardenPlantStorageCapacity: 0,
				upgradeItemMaximumRarity: 0,
				maxItemUpgradeLevel: 0,
				bedHealthRegeneration: HomeLevel.LEVEL_4.features.bedHealthRegeneration
			}
		});
		expect(data.owned?.chest?.slotsPerCategory).toEqual(HomeLevel.LEVEL_8.features.chestSlots);
		expect(data.owned?.upgradeStation).toBeUndefined();
	});

	it("keeps the bed of a small home reached from an apartment at its own level", async () => {
		vi.mocked(Apartments.getOfPlayerInCity).mockResolvedValue(makeApartment(HOME_CITY_ID, 0));

		const data = await buildHomeData(playerData(0), homeData(makeHome(OTHER_CITY_ID, 2)), getCity(HOME_CITY_ID));

		expect(data.owned?.features.bedHealthRegeneration).toBe(HomeLevel.LEVEL_2.features.bedHealthRegeneration);
	});

	it("gives no home access in a city where the player has neither the home nor an apartment", async () => {
		const data = await buildHomeData(playerData(0), homeData(makeHome(OTHER_CITY_ID, 2)), getCity(HOME_CITY_ID));

		expect(data.owned).toBeUndefined();
	});
});

describe("buildApartmentNotaryData", () => {
	it("sells the apartment of the city to a home owner, telling how much is missing", async () => {
		const home = makeHome(OTHER_CITY_ID, 1);
		const affordable = await buildApartmentNotaryData(makeCityPlayer(APARTMENT_PRICE), getCity(HOME_CITY_ID), home, NOW);
		const expensive = await buildApartmentNotaryData(makeCityPlayer(APARTMENT_PRICE - 10), getCity(HOME_CITY_ID), home, NOW);

		expect(affordable).toEqual({
			forSale: {
				price: APARTMENT_PRICE, canAfford: true
			},
			ownedApartments: []
		});
		expect(expensive.forSale).toEqual({
			price: APARTMENT_PRICE, canAfford: false, missingMoney: 10
		});
	});

	it("does not sell an apartment to a player without home nor a second one in the same city", async () => {
		vi.mocked(Apartments.getOfPlayer).mockResolvedValue([makeApartment(HOME_CITY_ID, 0)]);
		const alreadyOwned = await buildApartmentNotaryData(makeCityPlayer(1_000_000), getCity(HOME_CITY_ID), makeHome(OTHER_CITY_ID, 1), NOW);
		vi.mocked(Apartments.getOfPlayer).mockResolvedValue([]);
		const homeless = await buildApartmentNotaryData(makeCityPlayer(1_000_000), getCity(HOME_CITY_ID), null, NOW);

		expect(alreadyOwned.forSale).toBeUndefined();
		expect(homeless.forSale).toBeUndefined();
	});

	it("lists the owned apartments with their rent, claimable only when rented out and above the minimum", async () => {
		const rentedRich = makeApartment(HOME_CITY_ID, 1, 1);
		const rentedPoor = makeApartment(HOME_CITY_ID, 0.4, 2);
		const empty = makeApartment(OTHER_CITY_ID, 10, 3);
		const broken = makeApartment("unknown_city", 10, 4);
		vi.mocked(Apartments.getOfPlayer).mockResolvedValue([rentedRich, rentedPoor, empty, broken]);

		const data = await buildApartmentNotaryData(makeCityPlayer(0), getCity(OTHER_CITY_ID), makeHome(HOME_CITY_ID, 1), NOW);

		expect(data.ownedApartments.map(apartment => [apartment.apartmentId, apartment.cityId, apartment.accumulatedRent, apartment.isRented, apartment.canClaim]))
			.toEqual([
				[1, HOME_CITY_ID, HomeConstants.DAILY_RENT, true, true],
				[2, HOME_CITY_ID, Math.floor(0.4 * HomeConstants.DAILY_RENT), true, false],
				[3, OTHER_CITY_ID, 10 * HomeConstants.DAILY_RENT, false, false]
			]);
		expect(data.ownedApartments[0]).toMatchObject({
			mapLocationId: getCity(HOME_CITY_ID).maps[0], purchasePrice: 777
		});
	});

	it("makes a rent of exactly the minimum claimable", async () => {
		const days = HomeConstants.MIN_RENT_TO_CLAIM / HomeConstants.DAILY_RENT;
		vi.mocked(Apartments.getOfPlayer).mockResolvedValue([makeApartment(HOME_CITY_ID, days)]);

		const data = await buildApartmentNotaryData(makeCityPlayer(0), getCity(OTHER_CITY_ID), makeHome(HOME_CITY_ID, 1), NOW);

		expect(data.ownedApartments[0]).toMatchObject({
			accumulatedRent: HomeConstants.MIN_RENT_TO_CLAIM, canClaim: true
		});
	});
});

describe("buildUpgradeStationData", () => {
	it("lists the equipments the home can upgrade, with the materials of their next level", () => {
		const inventory = [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemLevel: 1
			}),
			makeInventorySlot({
				slot: 2, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
			}),
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID, itemLevel: null
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.ARMOR, itemId: 0
			}),
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.POTION, itemId: 1
			})
		];

		const data = buildUpgradeStationData(inventory, new Map([[24, 1], [70, 3], [20, 1]]), HomeLevel.LEVEL_1, makeCityPlayer(0));

		expect(data.maxUpgradeableRarity).toBe(HomeLevel.LEVEL_1.features.upgradeItemMaximumRarity);
		expect(data.upgradeableItems.map(item => ({
			category: item.category,
			slot: item.slot,
			id: item.details.id,
			nextLevel: item.nextLevel,
			canUpgrade: item.canUpgrade,
			requiredMaterials: item.requiredMaterials
		}))).toEqual([
			{
				category: ItemCategory.WEAPON,
				slot: 0,
				id: COMMON_WEAPON_ID,
				nextLevel: 1,
				canUpgrade: true,
				requiredMaterials: [
					{
						materialId: 24, quantity: 1, playerQuantity: 1
					},
					{
						materialId: 70, quantity: 1, playerQuantity: 3
					}
				]
			},
			{
				category: ItemCategory.ARMOR,
				slot: 0,
				id: COMMON_ARMOR_ID,
				nextLevel: 1,
				canUpgrade: false,
				requiredMaterials: [
					{
						materialId: 20, quantity: 1, playerQuantity: 1
					},
					{
						materialId: 79, quantity: 1, playerQuantity: 0
					}
				]
			}
		]);
	});

	it("aggregates the same material required several times", () => {
		const rareWeapon = makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
		});

		const [item] = buildUpgradeStationData([rareWeapon], new Map([[7, 1], [34, 1], [21, 1], [77, 1]]), HomeLevel.LEVEL_3, makeCityPlayer(0)).upgradeableItems;

		expect(item.requiredMaterials[0]).toEqual({
			materialId: 7, quantity: 2, playerQuantity: 1
		});
		expect(item.canUpgrade).toBe(false);
	});
});

describe("buildChestData", () => {
	it("lists the stored items, the depositable items and the inventory capacity including the home bonus", async () => {
		const home = makeHome(HOME_CITY_ID, 4);
		vi.mocked(HomeChestSlots.getOfHome).mockResolvedValue([
			makeChestSlot(1, COMMON_ARMOR_ID),
			makeChestSlot(2, 0)
		]);
		vi.spyOn(InventoryInfo, "findOne").mockResolvedValue(Object.assign(Object.create(InventoryInfo.prototype) as InventoryInfo, {
			weaponSlots: 2, armorSlots: 3, potionSlots: 4, objectSlots: 5, plantSlots: 2
		}));
		vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue([
			{
				plantId: 1, quantity: 2
			},
			{
				plantId: 2, quantity: 0
			}
		] as Awaited<ReturnType<typeof HomePlantStorages.getOfHome>>);
		vi.mocked(PlayerPlantSlots.getPlantSlots).mockResolvedValue([
			{
				slot: 0, plantId: 3
			}
		] as Awaited<ReturnType<typeof PlayerPlantSlots.getPlantSlots>>);
		const player = makeCityPlayer(0);

		const chest = await buildChestData(home, HomeLevel.LEVEL_4, [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: 0
			})
		], player);

		expect(HomeChestSlots.ensureSlotsForLevel).toHaveBeenCalledWith(home.id, HomeLevel.LEVEL_4.features.chestSlots);
		expect(PlayerPlantSlots.ensureSlotsForCount).toHaveBeenCalledWith(player.id, 2);
		expect(chest.chestItems.map(item => [item.category, item.slot, item.details.id])).toEqual([[ItemCategory.ARMOR, 1, COMMON_ARMOR_ID]]);
		expect(chest.depositableItems.map(item => [item.category, item.slot])).toEqual([[ItemCategory.WEAPON, 0]]);
		expect(chest.slotsPerCategory).toEqual(HomeLevel.LEVEL_4.features.chestSlots);
		expect(chest.inventoryCapacity).toEqual({
			weapon: 3, armor: 4, potion: 5, object: 6
		});
		expect(chest.plantMaxCapacity).toBe(HomeLevel.LEVEL_4.features.gardenPlantStorageCapacity);
		expect(chest.plantStorage).toEqual([
			{
				plantId: 1, quantity: 2, maxCapacity: HomeLevel.LEVEL_4.features.gardenPlantStorageCapacity
			}
		]);
		expect(chest.playerPlantSlots).toEqual([
			{
				slot: 0, plantId: 3
			}
		]);
	});

	it("counts one slot per category for a player without inventory info and skips the plants without garden", async () => {
		const chest = await buildChestData(makeHome(HOME_CITY_ID, 1), HomeLevel.LEVEL_1, [], makeCityPlayer(0));

		expect(chest.inventoryCapacity).toEqual({
			weapon: 1, armor: 1, potion: 1, object: 1
		});
		expect(chest.plantStorage).toBeUndefined();
		expect(chest.playerPlantSlots).toBeUndefined();
		expect(chest.plantMaxCapacity).toBeUndefined();
		expect(PlayerPlantSlots.ensureSlotsForCount).not.toHaveBeenCalled();
	});
});

describe("buildEnchanterData", () => {
	const enchantment = ItemEnchantment.PVE_ATTACK_1;

	beforeEach(() => {
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ gems: 12 } as PlayerMissionsInfo);
	});

	it("lists the unenchanted equipments of the enchantment slot and counts the others", async () => {
		const inventory = [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemEnchantmentId: ItemEnchantment.ALL_ATTACK_1.id
			}),
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.ARMOR, itemId: 0
			})
		];

		const data = await buildEnchanterData({
			inventory, player: makeCityPlayer(321)
		}, {
			enchantment, enchantmentId: enchantment.id, isPlayerMage: false
		});

		expect(data).toMatchObject({
			isInventoryEmpty: false,
			unenchantedItemsInOtherSlotCount: 1,
			enchantmentId: enchantment.id,
			enchantmentCost: enchantment.getEnchantmentCost(false),
			enchantmentType: enchantment.kind.type.id,
			enchantmentSlot: ItemCategory.WEAPON,
			mageReduction: false,
			playerMoney: 321,
			playerGems: 12
		});
		expect(data.enchantableItems.map(item => [item.category, item.slot, item.details.id])).toEqual([[ItemCategory.WEAPON, 0, COMMON_WEAPON_ID]]);
		expect(data.disenchantableItems.map(item => item.slot)).toEqual([1]);
		expect(data.tomorrow).toBeUndefined();
	});

	it("reduces the cost for a mage and reports an inventory without equipment", async () => {
		const tomorrow: EnchanterTomorrowData = {
			cityMapLocationId: 1, cityMapTypeId: MapLocationConstants.TYPES.CITY, enchantmentId: ItemEnchantment.DEFENSE_1.id, enchantmentType: ItemEnchantment.DEFENSE_1.kind.type.id
		};

		const data = await buildEnchanterData({
			inventory: [], player: makeCityPlayer(0)
		}, {
			enchantment, enchantmentId: enchantment.id, isPlayerMage: true, tomorrow
		});

		expect(data.isInventoryEmpty).toBe(true);
		expect(data.mageReduction).toBe(true);
		expect(data.enchantmentCost).toEqual(enchantment.getEnchantmentCost(true));
		expect(data.enchantmentCost.money).toBeLessThan(enchantment.getEnchantmentCost(false).money);
		expect(data.tomorrow).toEqual(tomorrow);
	});
});
