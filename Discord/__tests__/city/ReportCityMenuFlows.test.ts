import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/ReactionCollectorHandlers";
import { ReactionCollector } from "discord.js";
import { PacketUtils } from "../../src/utils/PacketUtils";
import {
	ReactionCollectorCity, ReactionCollectorCityData
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorReactPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CITY_SERVICES } from "../../../Lib/src/constants/CityServiceConstants";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { MapLocationConstants } from "../../../Lib/src/constants/MapLocationConstants";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { ScrapDealerMenuIds } from "../../src/commands/player/report/scrapDealer/ScrapDealerMenuConstants";
import {
	clickOn, collectorPacket, componentsOf, dispatch, FakeInteraction, fakeClick, fakeCommand, lastMessage, renderedText,
	sentPackets, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

type CityOverrides = Partial<ReactionCollectorCityData>;

function cityData(overrides: CityOverrides = {}): ReactionCollectorCityData {
	return {
		mapTypeId: MapLocationConstants.TYPES.VILLAGE,
		mapLocationId: 6,
		availableServices: [],
		inns: [
			{
				innId: "lordInn",
				meals: [
					{
						mealId: "breadAndCheese", price: 50, energy: 350
					},
					{
						mealId: "stew", price: 70, energy: 520
					}
				],
				rooms: [
					{
						roomId: "simpleRoom", price: 500, health: 14
					}
				]
			}
		],
		shops: [],
		energy: {
			current: 40, max: 100
		},
		health: {
			current: 80, max: 120
		},
		home: {},
		apartmentNotary: { ownedApartments: [] },
		...overrides
	} as ReactionCollectorCityData;
}

const WEAPON = {
	slot: 0,
	category: ItemCategory.WEAPON,
	details: {
		id: 1,
		rarity: 4,
		itemCategory: ItemCategory.WEAPON,
		itemLevel: 0,
		attack: {
			baseValue: 30, upgradeValue: 0, maxValue: Infinity
		},
		defense: {
			baseValue: 0, upgradeValue: 0, maxValue: Infinity
		},
		speed: {
			baseValue: 0, upgradeValue: 0, maxValue: Infinity
		}
	}
};

function enchanter(): NonNullable<ReactionCollectorCityData["enchanter"]> {
	return {
		enchantableItems: [WEAPON],
		isInventoryEmpty: false,
		disenchantableItems: [
			{
				...WEAPON,
				slot: 1,
				enchantmentId: ItemEnchantment.PVE_ATTACK_1.id,
				enchantmentType: ItemEnchantment.PVE_ATTACK_1.kind.type.id
			}
		],
		unenchantedItemsInOtherSlotCount: 0,
		enchantmentId: ItemEnchantment.PVP_ATTACK_1.id,
		enchantmentType: ItemEnchantment.PVP_ATTACK_1.kind.type.id,
		enchantmentSlot: ItemCategory.WEAPON,
		enchantmentCost: {
			money: 1000, gems: 5
		},
		mageReduction: false,
		playerMoney: 4000,
		playerGems: 10
	};
}

/**
 * Collector following Core's deadline of each displayed city, which never handles clicks
 */
const lifecycleCollectors = new WeakMap<FakeInteraction, ReactionCollector>();

async function openCity(overrides: CityOverrides = {}): Promise<FakeInteraction> {
	const {
		interaction, context
	} = fakeCommand("Citizen");
	await dispatch(context, collectorPacket(new ReactionCollectorCity(cityData(overrides))));
	const lifecycle = interaction.collectors.at(-1);
	expect(lifecycle).toBeDefined();
	lifecycleCollectors.set(interaction, lifecycle as ReactionCollector);
	return interaction;
}

/**
 * Collector of the menu currently displayed: the city menus replace their collector on each navigation
 */
function menuCollector(interaction: FakeInteraction): ReactionCollector {
	const collectors = interaction.collectors.filter(collector => !collector.ended && collector !== lifecycleCollectors.get(interaction));
	const current = collectors.at(-1);
	expect(current).toBeDefined();
	return current as ReactionCollector;
}

function customIds(interaction: FakeInteraction): (string | undefined)[] {
	return componentsOf(lastMessage(interaction)).map(component => component.custom_id);
}

async function click(interaction: FakeInteraction, customId: string): Promise<void> {
	await clickOn(menuCollector(interaction), fakeClick(interaction.user, customId));
}

function sentReactionTypes(city: ReactionCollectorCity): string[] {
	const packet = collectorPacket(city);
	return sentPackets(ReactionCollectorReactPacket).map(reaction => packet.reactions[reaction.packet.reactionIndex].type);
}

describe("city main menu", () => {
	it("offers the inns of the city, then leaving or staying", async () => {
		const interaction = await openCity();

		singleMessage(interaction);
		expect(customIds(interaction)).toEqual([
			`${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}lordInn`,
			ReportCityMenuIds.MAIN_MENU_EXIT_CITY,
			ReportCityMenuIds.MAIN_MENU_STAY_CITY
		]);
	});

	it.each([
		[ReportCityMenuIds.MAIN_MENU_EXIT_CITY, "ReactionCollectorExitCityReaction"],
		[ReportCityMenuIds.MAIN_MENU_STAY_CITY, "ReactionCollectorRefuseReaction"]
	])("sends the reaction of %s", async (customId, reactionType) => {
		const interaction = await openCity();

		await click(interaction, customId);

		expect(sentReactionTypes(new ReactionCollectorCity(cityData()))).toEqual([reactionType]);
	});
});

describe("inn", () => {
	it("lists the meals and rooms with their price, energy and health", async () => {
		const interaction = await openCity();

		await click(interaction, `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}lordInn`);

		const text = renderedText(lastMessage(interaction));
		expect(text).toContain("40");
		expect(text).toContain("350");
		expect(text).toContain("520");
		expect(text).toContain("14");
		expect(customIds(interaction)).toEqual([
			`${ReportCityMenuIds.MEAL_PREFIX}breadAndCheese`,
			`${ReportCityMenuIds.MEAL_PREFIX}stew`,
			`${ReportCityMenuIds.ROOM_PREFIX}simpleRoom`,
			ReportCityMenuIds.BACK_TO_CITY,
			ReportCityMenuIds.STAY_IN_CITY
		]);
	});

	it.each([
		[`${ReportCityMenuIds.MEAL_PREFIX}stew`, "stew"],
		[`${ReportCityMenuIds.ROOM_PREFIX}simpleRoom`, "simpleRoom"]
	])("orders %s at the inn", async (customId, orderedId) => {
		const interaction = await openCity();
		await click(interaction, `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}lordInn`);

		await click(interaction, customId);

		const packet = collectorPacket(new ReactionCollectorCity(cityData()));
		const [reaction] = sentPackets(ReactionCollectorReactPacket);
		expect(JSON.stringify(packet.reactions[reaction.packet.reactionIndex].data)).toContain(orderedId);
	});

	it("goes back to the city and stays in it", async () => {
		const interaction = await openCity();
		await click(interaction, `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}lordInn`);

		await click(interaction, ReportCityMenuIds.BACK_TO_CITY);
		expect(customIds(interaction)).toContain(ReportCityMenuIds.MAIN_MENU_EXIT_CITY);
		await click(interaction, `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}lordInn`);
		await click(interaction, ReportCityMenuIds.STAY_IN_CITY);

		expect(sentReactionTypes(new ReactionCollectorCity(cityData()))).toEqual(["ReactionCollectorRefuseReaction"]);
	});
});

describe("enchanter", () => {
	const withEnchanter = {
		availableServices: [CITY_SERVICES.ENCHANTER],
		enchanter: enchanter()
	};

	it("offers today's enchantment for the enchantable items and the removal of an enchantment", async () => {
		const interaction = await openCity(withEnchanter);

		await click(interaction, ReportCityMenuIds.ENCHANTER_MENU);

		const text = renderedText(lastMessage(interaction));
		expect(text).toContain("Attaque PvP I");
		expect(customIds(interaction)).toEqual(expect.arrayContaining([
			`${ReportCityMenuIds.ENCHANT_ITEM_PREFIX}0`,
			ReportCityMenuIds.ENCHANTER_DISENCHANT_MENU,
			ReportCityMenuIds.BACK_TO_CITY
		]));
	});

	it("confirms the enchantment with its price and the balance of the player before telling Core", async () => {
		const interaction = await openCity(withEnchanter);
		await click(interaction, ReportCityMenuIds.ENCHANTER_MENU);

		await click(interaction, `${ReportCityMenuIds.ENCHANT_ITEM_PREFIX}0`);

		const confirmation = renderedText(lastMessage(interaction));
		expect(confirmation).toMatch(/1[\s\u202f]?000/);
		expect(confirmation).toMatch(/4[\s\u202f]?000/);
		expect(sentPackets(ReactionCollectorReactPacket)).toEqual([]);

		await click(interaction, ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM);

		expect(sentReactionTypes(new ReactionCollectorCity(cityData(withEnchanter)))).toEqual(["ReactionCollectorEnchantReaction"]);
	});

	it("removes the enchantment of the chosen item after confirmation", async () => {
		const interaction = await openCity(withEnchanter);
		await click(interaction, ReportCityMenuIds.ENCHANTER_MENU);
		await click(interaction, ReportCityMenuIds.ENCHANTER_DISENCHANT_MENU);

		expect(renderedText(lastMessage(interaction))).toContain("Attaque PvE I");
		await click(interaction, `${ReportCityMenuIds.ENCHANTER_DISENCHANT_ITEM_PREFIX}0`);
		await click(interaction, ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM);

		expect(sentReactionTypes(new ReactionCollectorCity(cityData(withEnchanter)))).toEqual(["ReactionCollectorEnchanterDisenchantReaction"]);
	});

	it("explains that the inventory has nothing to enchant", async () => {
		const interaction = await openCity({
			availableServices: [CITY_SERVICES.ENCHANTER],
			enchanter: {
				...enchanter(),
				enchantableItems: [],
				disenchantableItems: [],
				isInventoryEmpty: true
			}
		});

		await click(interaction, ReportCityMenuIds.ENCHANTER_MENU);

		expect(customIds(interaction)).not.toContain(`${ReportCityMenuIds.ENCHANT_ITEM_PREFIX}0`);
		expect(customIds(interaction)).not.toContain(ReportCityMenuIds.ENCHANTER_DISENCHANT_MENU);
	});
});

describe("scrap dealer", () => {
	const withScrapDealer = {
		availableServices: [CITY_SERVICES.SCRAP_DEALER],
		scrapDealer: {
			recyclableItems: [
				{
					slot: 1,
					category: ItemCategory.WEAPON,
					itemId: WEAPON.details.id,
					details: WEAPON.details,
					recoveredMaterials: [
						{
							materialId: 1, quantity: 3
						}
					],
					recoveredMoney: 45
				}
			]
		}
	};

	it("previews what recycling an item gives back before telling Core", async () => {
		const interaction = await openCity(withScrapDealer);
		await click(interaction, ReportCityMenuIds.SCRAP_DEALER_MENU);
		expect(customIds(interaction)).toContain(`${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}0`);

		await click(interaction, `${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}0`);

		const preview = renderedText(lastMessage(interaction));
		expect(preview).toContain("Chlorate de potassium");
		expect(preview).toContain("45");
		expect(sentPackets(ReactionCollectorReactPacket)).toEqual([]);

		await click(interaction, ScrapDealerMenuIds.CONFIRM_RECYCLE);

		expect(sentReactionTypes(new ReactionCollectorCity(cityData(withScrapDealer)))).toEqual(["ReactionCollectorScrapDealerRecycleReaction"]);
	});

	it("goes back from the preview to the list, then to the city", async () => {
		const interaction = await openCity(withScrapDealer);
		await click(interaction, ReportCityMenuIds.SCRAP_DEALER_MENU);
		await click(interaction, `${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}0`);

		await click(interaction, ScrapDealerMenuIds.BACK_TO_LIST);
		expect(customIds(interaction)).toContain(`${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}0`);
		await click(interaction, ScrapDealerMenuIds.BACK_TO_CITY);

		expect(customIds(interaction)).toContain(ReportCityMenuIds.MAIN_MENU_EXIT_CITY);
		expect(sentPackets(ReactionCollectorReactPacket)).toEqual([]);
	});

	it("tells that nothing can be recycled", async () => {
		const interaction = await openCity({
			availableServices: [CITY_SERVICES.SCRAP_DEALER],
			scrapDealer: { recyclableItems: [] }
		});

		await click(interaction, ReportCityMenuIds.SCRAP_DEALER_MENU);

		expect(customIds(interaction)).not.toContain(`${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}0`);
	});
});
