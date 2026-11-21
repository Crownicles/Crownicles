import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	checkDrinkPotionMissions,
	consumePotion,
	countNbOfPotions,
	generateRandomLootLevel,
	getItemByIdAndCategory,
	giveRandomItem,
	getItemValue,
	haveRarityOrMore,
	sortPlayerItemList
} from "../../../src/core/utils/ItemUtils";
import InventorySlot, { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import Player from "../../../src/core/database/game/models/Player";
import { PlayerActiveObjects } from "../../../src/core/database/game/models/PlayerActiveObjects";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { WeaponDataController } from "../../../src/data/Weapon";
import { ArmorDataController } from "../../../src/data/Armor";
import {
	Potion, PotionDataController
} from "../../../src/data/Potion";
import { ObjectItemDataController } from "../../../src/data/ObjectItem";
import { GenericItem } from "../../../src/data/GenericItem";
import {
	ItemCategory, ItemConstants, ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandDrinkPacketRes } from "../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logItemGain: vi.fn().mockResolvedValue(undefined) } }
}));

type SlotFixture = {
	itemId?: number;
	itemCategory?: ItemCategory;
	isPotion?: boolean;
	item?: GenericItem | null;
};

/**
 * Build an inventory slot holding the given item, as loaded from the database
 */
function slot({
	itemId = 1, itemCategory = ItemCategory.WEAPON, isPotion = false, item = null
}: SlotFixture): InventorySlot {
	// Only the fields read by the helpers under test
	return {
		itemId,
		itemCategory,
		isPotion: () => isPotion,
		getItem: () => item
	} as unknown as InventorySlot;
}

/**
 * Get the first real item of the given rarity for a category
 */
function firstItemOfRarity(category: ItemCategory, rarity: ItemRarity): GenericItem {
	const controller = [
		WeaponDataController.instance,
		ArmorDataController.instance,
		PotionDataController.instance,
		ObjectItemDataController.instance
	][category];
	const item = controller.getById(controller.getAllIdsForRarity(rarity)[0]);
	if (!item) {
		throw new Error(`No item of rarity ${rarity} in category ${category}`);
	}
	return item;
}

describe("ItemUtils helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getItemValue", () => {
		it("should add the item added value to its rarity value", () => {
			const item = {
				rarity: ItemRarity.RARE,
				getItemAddedValue: (): number => 12.4
			} as GenericItem;

			expect(getItemValue(item)).toBe(ItemConstants.RARITY.VALUES[ItemRarity.RARE] + 12);
		});
	});

	describe("countNbOfPotions", () => {
		it("should only count non empty potion slots", () => {
			const slots = [
				slot({
					itemId: 4, isPotion: true
				}),
				slot({
					itemId: 0, isPotion: true
				}),
				slot({
					itemId: 7, isPotion: false
				}),
				slot({
					itemId: 9, isPotion: true
				})
			];

			expect(countNbOfPotions(slots)).toBe(2);
		});
	});

	describe("sortPlayerItemList", () => {
		it("should sort by category first, then by decreasing value", () => {
			const cheapWeapon = slot({
				itemCategory: ItemCategory.WEAPON, item: firstItemOfRarity(ItemCategory.WEAPON, ItemRarity.COMMON)
			});
			const preciousWeapon = slot({
				itemCategory: ItemCategory.WEAPON, item: firstItemOfRarity(ItemCategory.WEAPON, ItemRarity.MYTHICAL)
			});
			const cheapArmor = slot({
				itemCategory: ItemCategory.ARMOR, item: firstItemOfRarity(ItemCategory.ARMOR, ItemRarity.COMMON)
			});
			const preciousObject = slot({
				itemCategory: ItemCategory.OBJECT, item: firstItemOfRarity(ItemCategory.OBJECT, ItemRarity.MYTHICAL)
			});
			const midPotion = slot({
				itemCategory: ItemCategory.POTION, item: firstItemOfRarity(ItemCategory.POTION, ItemRarity.RARE)
			});

			expect(sortPlayerItemList([preciousObject, cheapArmor, midPotion, cheapWeapon, preciousWeapon]))
				.toEqual([preciousWeapon, cheapWeapon, cheapArmor, midPotion, preciousObject]);
		});
	});

	describe("haveRarityOrMore", () => {
		const slots = [ItemRarity.COMMON, ItemRarity.EPIC, ItemRarity.RARE]
			.map(rarity => slot({ item: firstItemOfRarity(ItemCategory.WEAPON, rarity) }));

		it("should be true when an item has exactly the rarity", () => {
			expect(haveRarityOrMore(slots, ItemRarity.EPIC)).toBe(true);
		});

		it("should be true when an item has a higher rarity", () => {
			expect(haveRarityOrMore(slots, ItemRarity.SPECIAL)).toBe(true);
		});

		it("should be false when every item has a lower rarity", () => {
			expect(haveRarityOrMore(slots, ItemRarity.LEGENDARY)).toBe(false);
		});
	});

	describe("getItemByIdAndCategory", () => {
		it.each([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		])("should find the item in the data of category %s", category => {
			const item = getItemByIdAndCategory(1, category);

			expect(item?.id).toBe(1);
			expect(item?.getCategory()).toBe(category);
		});

		it("should accept the highest id of the category", () => {
			const maxId = ArmorDataController.instance.getMaxId();

			expect(getItemByIdAndCategory(maxId, ItemCategory.ARMOR)?.id).toBe(maxId);
		});

		it.each([0, -1])("should return null for the invalid id %s", itemId => {
			expect(getItemByIdAndCategory(itemId, ItemCategory.WEAPON)).toBeNull();
		});

		it("should return null after the highest id of the category", () => {
			expect(getItemByIdAndCategory(WeaponDataController.instance.getMaxId() + 1, ItemCategory.WEAPON)).toBeNull();
		});

		it("should return null for an unknown category", () => {
			expect(getItemByIdAndCategory(1, 42 as ItemCategory)).toBeNull();
		});
	});

	describe("generateRandomLootLevel", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it.each([
			[0, 2],
			[0.0099, 2],
			[0.01, 1],
			[0.0599, 1],
			[0.06, 0],
			[1, 0]
		])("should map the roll %s to the level %s", (roll, level) => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(roll);

			expect(generateRandomLootLevel()).toBe(level);
		});
	});

	describe("giveRandomItem", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it.each([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		])("should give a random item of category %s with its random loot level and enchantment", async category => {
			vi.spyOn(RandomUtils, "enumPick").mockReturnValue(category);
			// The lowest roll gives the best level and always an enchantment to weapons and armors
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([]);
			// Only what giving an item to a player with free space reads
			const player = {
				id: 1,
				keycloakId: "kc",
				giveItem: vi.fn().mockResolvedValue(true),
				getMaxStatsValue: vi.fn().mockReturnValue({
					attack: 100, defense: 100, speed: 100
				})
			} as unknown as Player;

			await giveRandomItem({} as PacketContext, [], player);

			const [item, level, enchantmentId] = vi.mocked(player.giveItem).mock.calls[0];
			expect(item.getCategory()).toBe(category);
			if (category === ItemCategory.WEAPON || category === ItemCategory.ARMOR) {
				expect(level).toBe(2);
				expect(typeof enchantmentId).toBe("string");
			}
			else {
				// Level and enchantment only exist on equipment
				expect(level).toBe(0);
				expect(enchantmentId).toBeNull();
			}
		});
	});

	describe("consumePotion", () => {
		let player: Player;
		const activeObjects = { weapon: null } as unknown as PlayerActiveObjects; // Opaque token forwarded to addEnergy

		beforeEach(() => {
			// Only the stat mutators the potion effects call
			player = {
				addHealth: vi.fn().mockResolvedValue(undefined),
				addEnergy: vi.fn()
			} as unknown as Player;
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		/**
		 * A potion as found in the data files, reduced to what drinking reads
		 */
		function potion(nature: ItemNature, power: number): Potion {
			return {
				nature, power
			} as Potion;
		}

		it("should announce the drunk potion", async () => {
			const response: CrowniclesPacket[] = [];

			await consumePotion(response, potion(ItemNature.HEALTH, 25), player, activeObjects);

			expect(response).toHaveLength(1);
			expect(response[0]).toBeInstanceOf(CommandDrinkPacketRes);
			expect(response[0]).toMatchObject({
				value: 25, itemNature: ItemNature.HEALTH
			});
		});

		it("should heal the player with the health blessing multiplier", async () => {
			vi.spyOn(BlessingManager.getInstance(), "getHealthPotionMultiplier").mockReturnValue(2);
			const response: CrowniclesPacket[] = [];

			await consumePotion(response, potion(ItemNature.HEALTH, 25), player, activeObjects);

			expect(player.addHealth).toHaveBeenCalledWith({
				amount: 50, response, reason: NumberChangeReason.DRINK
			});
			expect(player.addEnergy).not.toHaveBeenCalled();
		});

		it("should give energy for an energy potion", async () => {
			await consumePotion([], potion(ItemNature.ENERGY, 40), player, activeObjects);

			expect(player.addEnergy).toHaveBeenCalledWith(40, NumberChangeReason.DRINK, activeObjects);
			expect(player.addHealth).not.toHaveBeenCalled();
		});

		it("should advance the travel time for a time speedup potion", async () => {
			const timeTravel = vi.spyOn(TravelTime, "timeTravel").mockResolvedValue(undefined);

			await consumePotion([], potion(ItemNature.TIME_SPEEDUP, 30), player, activeObjects);

			expect(timeTravel).toHaveBeenCalledWith(player, 30, NumberChangeReason.DRINK);
		});

		it("should have no effect for a potion without effect", async () => {
			const timeTravel = vi.spyOn(TravelTime, "timeTravel").mockResolvedValue(undefined);

			await consumePotion([], potion(ItemNature.NONE, 30), player, activeObjects);

			expect(player.addHealth).not.toHaveBeenCalled();
			expect(player.addEnergy).not.toHaveBeenCalled();
			expect(timeTravel).not.toHaveBeenCalled();
		});
	});

	describe("checkDrinkPotionMissions", () => {
		const player = { id: 1 } as Player;
		const inventory = [
			slot({
				itemId: 3, isPotion: true
			}),
			slot({
				itemId: 5, isPotion: true
			})
		];

		/**
		 * Get the mission updates done for the player
		 */
		function missionUpdates(): unknown[] {
			return vi.mocked(MissionsController.update).mock.calls.map(call => call[2]);
		}

		it("should update the drink, rarity, tag, no effect and potion count missions", async () => {
			const response: CrowniclesPacket[] = [];
			const tags = ["holy", "fire"];

			await checkDrinkPotionMissions(response, player, {
				rarity: ItemRarity.EPIC, nature: ItemNature.NONE, tags
			} as Potion, inventory);

			expect(vi.mocked(MissionsController.update).mock.calls.every(call => call[0] === player && call[1] === response)).toBe(true);
			expect(missionUpdates()).toEqual([
				{ missionId: "drinkPotion" },
				{
					missionId: "drinkPotionRarity", params: { rarity: ItemRarity.EPIC }
				},
				{
					missionId: "holy", params: { tags }
				},
				{
					missionId: "fire", params: { tags }
				},
				{ missionId: "drinkPotionWithoutEffect" },
				{
					missionId: "havePotions", count: 2, set: true
				}
			]);
		});

		it("should update the energy potion mission", async () => {
			await checkDrinkPotionMissions([], player, {
				rarity: ItemRarity.COMMON, nature: ItemNature.ENERGY
			} as Potion, inventory);

			expect(missionUpdates()).toEqual([
				{ missionId: "drinkPotion" },
				{
					missionId: "drinkPotionRarity", params: { rarity: ItemRarity.COMMON }
				},
				{ missionId: "drinkEnergyPotion" },
				{
					missionId: "havePotions", count: 2, set: true
				}
			]);
		});

		it("should not update the effect missions for a health potion", async () => {
			await checkDrinkPotionMissions([], player, {
				rarity: ItemRarity.COMMON, nature: ItemNature.HEALTH
			} as Potion, []);

			expect(missionUpdates()).toEqual([
				{ missionId: "drinkPotion" },
				{
					missionId: "drinkPotionRarity", params: { rarity: ItemRarity.COMMON }
				},
				{
					missionId: "havePotions", count: 0, set: true
				}
			]);
		});
	});
});
