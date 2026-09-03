import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import type {
	CityMobileDisenchantItem,
	CityMobileItem,
	CityMobileRecycleItem,
	CityMobileSnapshot,
	CityMobileUpgradeItem
} from "../../../../../../WsPackets/src/fromServer/collectors/families/CityCollectors";

type CityMobileOwnedHome = NonNullable<NonNullable<CityMobileSnapshot["home"]>["owned"]>;
type CityMobileGarden = NonNullable<CityMobileOwnedHome["garden"]>;
type CityMobileHomeManage = NonNullable<NonNullable<CityMobileSnapshot["home"]>["manage"]>;
type CityMobileApartmentNotary = NonNullable<CityMobileSnapshot["apartmentNotary"]>;
type CityMobileBlacksmith = NonNullable<CityMobileSnapshot["blacksmith"]>;
type CityMobileScrapDealer = NonNullable<CityMobileSnapshot["scrapDealer"]>;
type CityMobileRoyalBlacksmith = NonNullable<CityMobileSnapshot["royalBlacksmith"]>;
type CityMobileEnchanter = NonNullable<CityMobileSnapshot["enchanter"]>;
type CityMobileGuildDomain = NonNullable<CityMobileSnapshot["guildDomain"]>;
type CityMobileGuildDomainNotary = NonNullable<CityMobileSnapshot["guildDomainNotary"]>;
type CityMobileGuildFoodShop = NonNullable<CityMobileSnapshot["guildFoodShop"]>;

function itemSnapshot(item: {
	slot: number;
	category: number;
	details: {
		id: number; itemLevel: number;
	};
}): CityMobileItem {
	return {
		slot: item.slot, itemId: item.details.id, itemCategory: item.category, itemLevel: item.details.itemLevel
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

function mapGarden(garden: NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["garden"]>): CityMobileGarden {
	return {
		plots: garden.plots.map(plot => ({
			slot: plot.slot, plantId: plot.plantId, growthProgress: plot.growthProgress, isReady: plot.isReady, readyAtTimestamp: plot.readyAtTimestamp
		})),
		hasSeed: garden.hasSeed,
		seedPlantId: garden.seedPlantId,
		eligibility: { ...garden.eligibility }
	};
}

function mapOwnedHome(ownedHome: NonNullable<ReactionCollectorCityData["home"]["owned"]>): CityMobileOwnedHome {
	return {
		level: ownedHome.level,
		...ownedHome.isApartment === undefined ? {} : { isApartment: ownedHome.isApartment },
		cookingLevel: ownedHome.cooking.level,
		cookingSlots: ownedHome.features.cookingSlots,
		bedHealthRegeneration: ownedHome.features.bedHealthRegeneration,
		gardenPlots: ownedHome.features.gardenPlots,
		hasBed: ownedHome.features.bedHealthRegeneration > 0,
		hasChest: ownedHome.features.chestSlots.weapon + ownedHome.features.chestSlots.armor + ownedHome.features.chestSlots.object + ownedHome.features.chestSlots.potion > 0,
		hasGarden: ownedHome.features.gardenPlots > 0,
		hasCooking: ownedHome.features.cookingSlots > 0,
		hasUpgradeStation: ownedHome.upgradeStation !== undefined,
		upgradeableItemCount: ownedHome.upgradeStation?.upgradeableItems.length ?? 0,
		...ownedHome.chest === undefined
			? {}
			: {
				chestItemCount: ownedHome.chest.chestItems.length, depositableItemCount: ownedHome.chest.depositableItems.length
			},
		...ownedHome.garden === undefined
			? {}
			: {
				gardenReadyPlots: ownedHome.garden.plots.filter(plot => plot.isReady).length, gardenTotalPlots: ownedHome.garden.totalPlots, garden: mapGarden(ownedHome.garden)
			}
	};
}

function mapHomeManage(manage: NonNullable<ReactionCollectorCityData["home"]["manage"]>): CityMobileHomeManage {
	return {
		...manage.newPrice === undefined ? {} : { newPrice: manage.newPrice },
		...manage.upgrade === undefined ? {} : { upgradePrice: manage.upgrade.price },
		...manage.movePrice === undefined ? {} : { movePrice: manage.movePrice },
		currentMoney: manage.currentMoney,
		...manage.canBuy === undefined ? {} : { canBuy: manage.canBuy },
		...manage.canUpgrade === undefined ? {} : { canUpgrade: manage.canUpgrade },
		...manage.canMove === undefined ? {} : { canMove: manage.canMove }
	};
}

function mapApartmentNotary(data: ReactionCollectorCityData["apartmentNotary"]): CityMobileApartmentNotary {
	return {
		...data.forSale === undefined
			? {}
			: { forSale: {
				price: data.forSale.price, canAfford: data.forSale.canAfford, ...data.forSale.canAfford ? {} : { missingMoney: data.forSale.missingMoney }
			} },
		ownedApartments: data.ownedApartments.map(apartment => ({
			apartmentId: apartment.apartmentId, mapLocationId: apartment.mapLocationId, accumulatedRent: apartment.accumulatedRent, isRented: apartment.isRented, canClaim: apartment.canClaim
		})),
		ownedCount: data.ownedApartments.length,
		accumulatedRent: data.ownedApartments.reduce((total, apartment) => total + apartment.accumulatedRent, 0)
	};
}

function mapBlacksmith(data: NonNullable<ReactionCollectorCityData["blacksmith"]>): CityMobileBlacksmith {
	return {
		playerMoney: data.playerMoney,
		upgradeableItems: data.upgradeableItems.map(upgradeItemSnapshot),
		disenchantableItems: data.disenchantableItems.map(item => ({
			...itemSnapshot(item), enchantmentId: item.enchantmentId, enchantmentType: item.enchantmentType, disenchantCost: item.disenchantCost, canDisenchant: item.canDisenchant
		} satisfies CityMobileDisenchantItem))
	};
}

function mapScrapDealer(data: NonNullable<ReactionCollectorCityData["scrapDealer"]>): CityMobileScrapDealer {
	return { recyclableItems: data.recyclableItems.map(item => ({
		...itemSnapshot(item), recoveredMaterials: item.recoveredMaterials.map(material => ({ ...material })), recoveredMoney: item.recoveredMoney
	} satisfies CityMobileRecycleItem)) };
}

function mapRoyalBlacksmith(data: NonNullable<ReactionCollectorCityData["royalBlacksmith"]>): CityMobileRoyalBlacksmith {
	return {
		status: data.status,
		playerLevel: data.playerLevel,
		requiredPlayerLevel: data.requiredPlayerLevel,
		playerMoney: data.playerMoney,
		playerGems: data.playerGems,
		upgradeableItems: data.upgradeableItems.map(upgradeItemSnapshot)
	};
}

function mapEnchanter(data: NonNullable<ReactionCollectorCityData["enchanter"]>): CityMobileEnchanter {
	return {
		...data,
		enchantableItems: data.enchantableItems.map(item => itemSnapshot(item))
	};
}

function mapEquipmentSnapshots(data: ReactionCollectorCityData): Pick<CityMobileSnapshot, "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith"> {
	return {
		...data.enchanter === undefined ? {} : { enchanter: mapEnchanter(data.enchanter) },
		...data.blacksmith === undefined ? {} : { blacksmith: mapBlacksmith(data.blacksmith) },
		...data.scrapDealer === undefined ? {} : { scrapDealer: mapScrapDealer(data.scrapDealer) },
		...data.royalBlacksmith === undefined ? {} : { royalBlacksmith: mapRoyalBlacksmith(data.royalBlacksmith) }
	};
}

function mapGuildDomain(data: NonNullable<ReactionCollectorCityData["guildDomain"]>): CityMobileGuildDomain {
	return {
		...data, food: { ...data.food }
	};
}

function mapGuildSnapshots(data: ReactionCollectorCityData): Pick<CityMobileSnapshot, "guildDomain" | "guildDomainNotary" | "guildFoodShop"> {
	return {
		...data.guildDomain === undefined ? {} : { guildDomain: mapGuildDomain(data.guildDomain) },
		...data.guildDomainNotary === undefined ? {} : { guildDomainNotary: { ...data.guildDomainNotary } satisfies CityMobileGuildDomainNotary },
		...data.guildFoodShop === undefined ? {} : { guildFoodShop: { ...data.guildFoodShop } satisfies CityMobileGuildFoodShop }
	};
}

export function mapCitySnapshot(data: ReactionCollectorCityData): CityMobileSnapshot {
	const snapshot: CityMobileSnapshot = {
		energy: data.energy,
		health: data.health,
		inns: data.inns?.map(inn => ({ innId: inn.innId })),
		shops: data.shops?.map(shop => ({
			shopId: shop.shopId, isEmpty: Boolean(shop.isEmpty)
		})),
		otherCityServices: data.otherCityServices?.map(service => ({ ...service })),
		home: {
			owned: data.home.owned ? mapOwnedHome(data.home.owned) : undefined, manage: data.home.manage ? mapHomeManage(data.home.manage) : undefined
		},
		apartmentNotary: mapApartmentNotary(data.apartmentNotary)
	};
	return {
		...snapshot, ...mapEquipmentSnapshots(data), ...mapGuildSnapshots(data)
	};
}
