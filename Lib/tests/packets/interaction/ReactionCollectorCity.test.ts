import {
	describe, expect, it
} from "vitest";
import {
	EnchanterCityData,
	ReactionCollectorApartmentBuyReaction,
	ReactionCollectorApartmentClaimRentReaction,
	ReactionCollectorBlacksmithEnchantmentTransferReaction,
	ReactionCollectorBlacksmithMenuReaction,
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorCity,
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityShopReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorEnchanterDisenchantReaction,
	ReactionCollectorEnchantReaction,
	ReactionCollectorExitCityReaction,
	ReactionCollectorGardenCompostReaction,
	ReactionCollectorGardenHarvestReaction,
	ReactionCollectorGardenWaterReaction,
	ReactionCollectorGuildDomainMenuReaction,
	ReactionCollectorGuildDomainNotaryReaction,
	ReactionCollectorHomeBedReaction,
	ReactionCollectorHomeChestCloseReaction,
	ReactionCollectorHomeMenuReaction,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction,
	ReactionCollectorRoyalBlacksmithMenuReaction,
	ReactionCollectorRoyalBlacksmithUpgradeReaction,
	ReactionCollectorScrapDealerMenuReaction,
	ReactionCollectorScrapDealerRecycleReaction,
	ReactionCollectorUpgradeItemReaction
} from "../../../src/packets/interaction/ReactionCollectorCity";
import {
	ReactionCollectorReaction, ReactionCollectorRefuseReaction
} from "../../../src/packets/interaction/ReactionCollectorPacket";
import { ItemCategory } from "../../../src/constants/ItemConstants";
import { GardenAccessMode } from "../../../src/types/GardenAccessMode";
import { PlantId } from "../../../src/constants/PlantConstants";
import { OwnedApartmentSummary } from "../../../src/types/ApartmentLocation";

type CityData = ReactionCollectorCityData;
type OwnedHome = NonNullable<CityData["home"]["owned"]>;
type Garden = NonNullable<OwnedHome["garden"]>;

type ExpectedReaction = [new () => ReactionCollectorReaction, object?];

const EXIT_AND_REFUSE: ExpectedReaction[] = [[ReactionCollectorExitCityReaction], [ReactionCollectorRefuseReaction]];

function cityData(overrides: Partial<CityData> = {}): CityData {
	return Object.assign(new ReactionCollectorCityData(), {
		mapTypeId: "ci",
		mapLocationId: 4,
		availableServices: [],
		energy: {
			current: 50, max: 100
		},
		health: {
			current: 80, max: 120
		},
		home: {},
		apartmentNotary: { ownedApartments: [] }
	}, overrides);
}

/*
 * The fixtures only fill the fields the collector reads: the remaining ones are display data the collector forwards
 * untouched in the packet data
 */
function ownedHome(fields: Partial<OwnedHome>): OwnedHome {
	return fields as OwnedHome;
}

function garden(accessMode: GardenAccessMode, plantStorage: Garden["plantStorage"] = []): Garden {
	return {
		accessMode, plantStorage
	} as Partial<Garden> as Garden;
}

function expectReactions(data: CityData, expected: ExpectedReaction[]): void {
	const packet = new ReactionCollectorCity(data).creationPacket("city", 1_000);

	expect(packet.reactions.map(r => [r.type, { ...r.data }])).toEqual(expected.map(([Class, fields]) => [Class.name, fields ?? {}]));
	packet.reactions.forEach((r, index) => expect(r.data).toBeInstanceOf(expected[index][0]));
}

describe("ReactionCollectorCity", () => {
	it("forwards the city data and always offers to leave or close the city", () => {
		const data = cityData({ minimumCityStayScore: 10 });
		const packet = new ReactionCollectorCity(data).creationPacket("city", 1_000);

		expect(packet.id).toBe("city");
		expect(packet.endTime).toBe(1_000);
		expect(packet.data.type).toBe(ReactionCollectorCityData.name);
		expect(packet.data.data).toBeInstanceOf(ReactionCollectorCityData);
		expect(packet.data.data).toEqual(data);
		expectReactions(data, EXIT_AND_REFUSE);
	});

	it("offers every meal then every room of every inn", () => {
		const meal = {
			mealId: "soup", price: 10, energy: 20
		};
		const room = {
			roomId: "bed", price: 30, health: 40
		};

		expectReactions(cityData({
			inns: [
				{
					innId: "inn1", meals: [meal], rooms: [room]
				},
				{
					innId: "inn2", meals: [meal], rooms: []
				}
			]
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorInnMealReaction, {
				innId: "inn1", meal
			}],
			[ReactionCollectorInnMealReaction, {
				innId: "inn2", meal
			}],
			[ReactionCollectorInnRoomReaction, {
				innId: "inn1", room
			}]
		]);
	});

	it("offers to enchant then to disenchant the eligible items", () => {
		expectReactions(cityData({
			enchanter: {
				enchantableItems: [{ slot: 0, category: ItemCategory.WEAPON }],
				disenchantableItems: [{ slot: 1, category: ItemCategory.ARMOR }]
			} as Partial<EnchanterCityData> as EnchanterCityData
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorEnchantReaction, {
				slot: 0, itemCategory: ItemCategory.WEAPON
			}],
			[ReactionCollectorEnchanterDisenchantReaction, {
				slot: 1, itemCategory: ItemCategory.ARMOR
			}]
		]);
	});

	it("only offers the shops that have something to sell", () => {
		expectReactions(cityData({
			shops: [
				{ shopId: "general" },
				{
					shopId: "empty", isEmpty: true
				},
				{
					shopId: "tokens", isEmpty: false
				}
			]
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorCityShopReaction, { shopId: "general" }],
			[ReactionCollectorCityShopReaction, { shopId: "tokens" }]
		]);
	});

	describe("home management", () => {
		it.each([
			["buying a home", { newPrice: 1_000 }, ReactionCollectorCityBuyHomeReaction],
			["upgrading the home", { upgrade: { price: 500 } }, ReactionCollectorCityUpgradeHomeReaction],
			["moving the home", { movePrice: 300 }, ReactionCollectorCityMoveHomeReaction],
			["buying a home rather than upgrading or moving", {
				newPrice: 1_000, upgrade: { price: 500 }, movePrice: 300
			}, ReactionCollectorCityBuyHomeReaction],
			["upgrading the home rather than moving it", {
				upgrade: { price: 500 }, movePrice: 300
			}, ReactionCollectorCityUpgradeHomeReaction]
		])("offers %s", (_case, manage, Reaction) => {
			expectReactions(cityData({
				home: {
					manage: {
						currentMoney: 2_000, ...manage
					} as NonNullable<CityData["home"]["manage"]>
				}
			}), [...EXIT_AND_REFUSE, [Reaction]]);
		});

		it("offers nothing when no home operation is possible", () => {
			expectReactions(cityData({ home: { manage: { currentMoney: 0 } } }), EXIT_AND_REFUSE);
		});
	});

	describe("owned home", () => {
		const storage = [
			{
				plantId: PlantId.COMMON_HERB, quantity: 7, maxCapacity: 10
			},
			{
				plantId: PlantId.LUNAR_MOSS, quantity: 2, maxCapacity: 10
			},
			{
				plantId: PlantId.IRON_ROOT, quantity: 0, maxCapacity: 10
			}
		];

		it("offers the home menu, the bed, the item upgrades, the garden and the chest closing", () => {
			expectReactions(cityData({
				home: {
					owned: ownedHome({
						upgradeStation: {
							upgradeableItems: [{ slot: 0, category: ItemCategory.ARMOR }]
						} as NonNullable<OwnedHome["upgradeStation"]>,
						garden: garden(GardenAccessMode.FULL, storage),
						chest: {} as NonNullable<OwnedHome["chest"]>
					})
				}
			}), [
				...EXIT_AND_REFUSE,
				[ReactionCollectorHomeMenuReaction],
				[ReactionCollectorHomeBedReaction],
				[ReactionCollectorUpgradeItemReaction, {
					slot: 0, itemCategory: ItemCategory.ARMOR
				}],
				[ReactionCollectorGardenHarvestReaction],
				[ReactionCollectorGardenWaterReaction],
				[ReactionCollectorGardenCompostReaction, {
					plantId: PlantId.COMMON_HERB, quantity: 1
				}],
				[ReactionCollectorGardenCompostReaction, {
					plantId: PlantId.COMMON_HERB, quantity: 5
				}],
				[ReactionCollectorGardenCompostReaction, {
					plantId: PlantId.LUNAR_MOSS, quantity: 1
				}],
				[ReactionCollectorHomeChestCloseReaction]
			]);
		});

		it("offers to compost exactly the stored quantity", () => {
			expectReactions(cityData({
				home: {
					owned: ownedHome({
						garden: garden(GardenAccessMode.FULL, [
							{
								plantId: PlantId.FIRE_BULB, quantity: 5, maxCapacity: 10
							}
						])
					})
				}
			}), [
				...EXIT_AND_REFUSE,
				[ReactionCollectorHomeMenuReaction],
				[ReactionCollectorHomeBedReaction],
				[ReactionCollectorGardenHarvestReaction],
				[ReactionCollectorGardenWaterReaction],
				[ReactionCollectorGardenCompostReaction, {
					plantId: PlantId.FIRE_BULB, quantity: 1
				}],
				[ReactionCollectorGardenCompostReaction, {
					plantId: PlantId.FIRE_BULB, quantity: 5
				}]
			]);
		});

		it("only offers to harvest a garden seen from afar, without the bed", () => {
			expectReactions(cityData({
				gardenOnly: true,
				home: { owned: ownedHome({ garden: garden(GardenAccessMode.READ_ONLY, storage) }) }
			}), [
				[ReactionCollectorRefuseReaction],
				[ReactionCollectorHomeMenuReaction],
				[ReactionCollectorGardenHarvestReaction]
			]);
		});

		it("offers the home menu and the bed of a home without garden nor chest", () => {
			expectReactions(cityData({ home: { owned: ownedHome({}) } }), [
				...EXIT_AND_REFUSE,
				[ReactionCollectorHomeMenuReaction],
				[ReactionCollectorHomeBedReaction]
			]);
		});

		it("only offers to close a garden-only view when no home is owned", () => {
			expectReactions(cityData({ gardenOnly: true }), [[ReactionCollectorRefuseReaction]]);
		});
	});

	it("offers the blacksmith menu, both upgrade modes of each item and each enchantment transfer", () => {
		expectReactions(cityData({
			blacksmith: {
				upgradeableItems: [{ slot: 2, category: ItemCategory.WEAPON }],
				enchantmentTransfers: [
					{
						slot: 0, category: ItemCategory.ARMOR, targets: [{ slot: 1 }, { slot: 3 }]
					}
				]
			} as Partial<NonNullable<CityData["blacksmith"]>> as NonNullable<CityData["blacksmith"]>
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorBlacksmithMenuReaction],
			[ReactionCollectorBlacksmithUpgradeReaction, {
				slot: 2, itemCategory: ItemCategory.WEAPON, buyMaterials: false
			}],
			[ReactionCollectorBlacksmithUpgradeReaction, {
				slot: 2, itemCategory: ItemCategory.WEAPON, buyMaterials: true
			}],
			[ReactionCollectorBlacksmithEnchantmentTransferReaction, {
				itemCategory: ItemCategory.ARMOR, sourceSlot: 0, targetSlot: 1
			}],
			[ReactionCollectorBlacksmithEnchantmentTransferReaction, {
				itemCategory: ItemCategory.ARMOR, sourceSlot: 0, targetSlot: 3
			}]
		]);
	});

	it("offers the scrap dealer menu and the recycling of each item", () => {
		expectReactions(cityData({
			scrapDealer: {
				recyclableItems: [
					{
						slot: 1, category: ItemCategory.WEAPON, itemId: 42
					}
				]
			} as Partial<NonNullable<CityData["scrapDealer"]>> as NonNullable<CityData["scrapDealer"]>
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorScrapDealerMenuReaction],
			[ReactionCollectorScrapDealerRecycleReaction, {
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: 42
			}]
		]);
	});

	it("offers the royal blacksmith menu and both upgrade modes of each item", () => {
		expectReactions(cityData({
			royalBlacksmith: {
				upgradeableItems: [{ slot: 0, category: ItemCategory.ARMOR }]
			} as Partial<NonNullable<CityData["royalBlacksmith"]>> as NonNullable<CityData["royalBlacksmith"]>
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorRoyalBlacksmithMenuReaction],
			[ReactionCollectorRoyalBlacksmithUpgradeReaction, {
				slot: 0, itemCategory: ItemCategory.ARMOR, buyMaterials: false
			}],
			[ReactionCollectorRoyalBlacksmithUpgradeReaction, {
				slot: 0, itemCategory: ItemCategory.ARMOR, buyMaterials: true
			}]
		]);
	});

	it("offers the guild domain in its city and the domain notary to the guild chief only", () => {
		const guildDomain = (isInCity: boolean): NonNullable<CityData["guildDomain"]> => ({ isInCity }) as NonNullable<CityData["guildDomain"]>;
		const notary = (isChief: boolean): NonNullable<CityData["guildDomainNotary"]> => ({ isChief }) as NonNullable<CityData["guildDomainNotary"]>;

		expectReactions(cityData({
			guildDomain: guildDomain(true), guildDomainNotary: notary(true)
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorGuildDomainMenuReaction],
			[ReactionCollectorGuildDomainNotaryReaction]
		]);
		expectReactions(cityData({
			guildDomain: guildDomain(false), guildDomainNotary: notary(false)
		}), EXIT_AND_REFUSE);
	});

	it("offers to buy the apartment for sale and to claim the rent of each owned apartment", () => {
		const owned = (apartmentId: number): OwnedApartmentSummary => ({ apartmentId }) as OwnedApartmentSummary;

		expectReactions(cityData({
			apartmentNotary: {
				forSale: {
					price: 10_000, canAfford: true
				},
				ownedApartments: [owned(5), owned(8)]
			}
		}), [
			...EXIT_AND_REFUSE,
			[ReactionCollectorApartmentBuyReaction],
			[ReactionCollectorApartmentClaimRentReaction, { apartmentId: 5 }],
			[ReactionCollectorApartmentClaimRentReaction, { apartmentId: 8 }]
		]);
	});
});
