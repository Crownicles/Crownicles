import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { Sequelize } from "sequelize";
import InventorySlot, {
	initModel as initInventorySlot, InventorySlots
} from "../../../../src/core/database/game/models/InventorySlot";
import Player from "../../../../src/core/database/game/models/Player";
import {
	ItemCategory, ItemConstants
} from "../../../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../../../Lib/src/types/ItemEnchantment";
import { MainItemDetails } from "../../../../../Lib/src/types/MainItemDetails";
import { WeaponDataController } from "../../../../src/data/Weapon";
import { ArmorDataController } from "../../../../src/data/Armor";

const sequelize = new Sequelize({
	dialect: "mariadb", logging: false
});
initInventorySlot(sequelize);

// Weapon 1 is holy and ranged, weapon 3 has no tag, object 11 is holy
const HOLY_RANGED_WEAPON_ID = 1;
const UNTAGGED_WEAPON_ID = 3;
const HOLY_OBJECT_ID = 11;

/**
 * Build an unsaved inventory slot
 */
function buildSlot(values: Partial<{
	playerId: number;
	slot: number;
	itemCategory: ItemCategory;
	itemId: number;
	itemLevel: number;
	itemEnchantmentId: string | null;
	remainingPotionUsages: number | null;
}> = {}): InventorySlot {
	return InventorySlot.build({
		playerId: 1,
		slot: 0,
		itemCategory: ItemCategory.WEAPON,
		itemId: UNTAGGED_WEAPON_ID,
		itemLevel: 0,
		itemEnchantmentId: null,
		...values
	});
}

/**
 * First enchantment made for the given equipment slot
 */
function enchantmentFor(category: ItemCategory.WEAPON | ItemCategory.ARMOR): ItemEnchantment {
	const enchantment = ItemEnchantment.getAllEnchantments().find(e => e.kind.slot === category);
	if (!enchantment) {
		throw new Error(`No enchantment for category ${category}`);
	}
	return enchantment;
}

describe("InventorySlot", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("getItem", () => {
		it.each([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		])("should read the item in the data of category %s", itemCategory => {
			const item = buildSlot({
				itemCategory, itemId: 2
			}).getItem();

			expect(item?.id).toBe(2);
			expect(item?.getCategory()).toBe(itemCategory);
		});

		it.each([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		])("should return null for an unknown item of category %s", itemCategory => {
			expect(buildSlot({
				itemCategory, itemId: 99999
			}).getItem()).toBeNull();
		});

		it("should return null for an unknown category", () => {
			expect(buildSlot({ itemCategory: 9 as ItemCategory }).getItem()).toBeNull();
		});
	});

	describe("slot kind", () => {
		it.each([
			[0, true],
			[1, false]
		])("should consider the slot %s equipped: %s", (slot, equipped) => {
			expect(buildSlot({ slot }).isEquipped()).toBe(equipped);
		});

		it.each([
			[ItemCategory.WEAPON, [true, false, true, false, false]],
			[ItemCategory.ARMOR, [false, true, true, false, false]],
			[ItemCategory.POTION, [false, false, false, true, false]],
			[ItemCategory.OBJECT, [false, false, false, false, true]]
		])("should tell the kind of a slot of category %s", (itemCategory, expected) => {
			const slot = buildSlot({ itemCategory });

			expect([slot.isWeapon(), slot.isArmor(), slot.isWeaponOrArmor(), slot.isPotion(), slot.isObject()]).toEqual(expected);
		});

		it.each([
			[ItemCategory.WEAPON, 5, true],
			[ItemCategory.ARMOR, 5, true],
			[ItemCategory.WEAPON, 0, false],
			[ItemCategory.POTION, 5, false]
		])("should consider a slot of category %s holding the item %s a primary equipment: %s", (itemCategory, itemId, primary) => {
			expect(buildSlot({
				itemCategory, itemId
			}).isPrimaryEquipment()).toBe(primary);
		});
	});

	describe("itemWithDetails", () => {
		it("should describe the held item with its level and enchantment", () => {
			const enchantment = enchantmentFor(ItemCategory.WEAPON);
			const player = { getMaxStatsValue: () => ({
				attack: 100, defense: 100, speed: 100
			}) } as unknown as Player; // Only the max stats are read

			const details = buildSlot({
				itemId: UNTAGGED_WEAPON_ID, itemLevel: 3, itemEnchantmentId: enchantment.id
			}).itemWithDetails(player) as MainItemDetails;

			expect(details).toMatchObject({
				id: UNTAGGED_WEAPON_ID,
				itemCategory: ItemCategory.WEAPON,
				itemLevel: 3,
				itemEnchantmentId: enchantment.id
			});
			expect(details.attack.maxValue).toBe(100);
		});
	});

	describe("canReceiveEnchantment", () => {
		it("should accept an enchantment made for an unenchanted equipment of its category", () => {
			expect(buildSlot({ itemCategory: ItemCategory.ARMOR }).canReceiveEnchantment(enchantmentFor(ItemCategory.ARMOR))).toBe(true);
		});

		it("should refuse an already enchanted equipment", () => {
			const enchantment = enchantmentFor(ItemCategory.WEAPON);

			expect(buildSlot({ itemEnchantmentId: enchantment.id }).canReceiveEnchantment(enchantment)).toBe(false);
		});

		it("should refuse an enchantment made for the other equipment category", () => {
			expect(buildSlot({ itemCategory: ItemCategory.WEAPON }).canReceiveEnchantment(enchantmentFor(ItemCategory.ARMOR))).toBe(false);
		});

		it("should refuse an empty slot", () => {
			expect(buildSlot({ itemId: 0 }).canReceiveEnchantment(enchantmentFor(ItemCategory.WEAPON))).toBe(false);
		});
	});

	describe("holdsItem", () => {
		const details = {
			id: UNTAGGED_WEAPON_ID, itemLevel: 2, itemEnchantmentId: undefined
		} as MainItemDetails;

		it("should recognize the same unenchanted item", () => {
			expect(buildSlot({
				itemLevel: 2, itemEnchantmentId: null
			}).holdsItem(details)).toBe(true);
		});

		it("should recognize the same enchanted item", () => {
			expect(buildSlot({
				itemLevel: 2, itemEnchantmentId: "pvpAttack1"
			}).holdsItem({
				...details, itemEnchantmentId: "pvpAttack1"
			})).toBe(true);
		});

		it.each([
			["item", { itemId: HOLY_RANGED_WEAPON_ID }],
			["level", { itemLevel: 3 }],
			["enchantment", { itemEnchantmentId: "pvpAttack1" }]
		])("should not recognize an item with another %s", (_name, values) => {
			expect(buildSlot({
				itemLevel: 2, ...values
			}).holdsItem(details)).toBe(false);
		});
	});

	it("should identify a slot by its player, position and category when saving it", () => {
		expect(buildSlot({
			playerId: 7, slot: 2, itemCategory: ItemCategory.ARMOR
		}).where()).toEqual({
			playerId: 7, slot: 2, itemCategory: ItemCategory.ARMOR
		});
	});

	it("should accept an unenchanted slot without potion usages", async () => {
		await expect(buildSlot({
			itemEnchantmentId: null, remainingPotionUsages: null
		}).validate()).resolves.toBeDefined();
	});

	it("should refresh the update date before every save", async () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
		const slot = buildSlot();
		slot.updatedAt = new Date(2020, 0, 1);

		// runHooks exists on every model but is missing from the Sequelize typings
		await (InventorySlot as unknown as { runHooks: (hook: string, ...args: unknown[]) => Promise<void> }).runHooks("beforeSave", slot, {});

		expect(slot.updatedAt).toEqual(new Date(2026, 2, 10, 12, 0, 0));
	});
});

describe("InventorySlots", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * A full inventory whose backup slots and other categories are listed before the equipped slots
	 */
	function inventory(): InventorySlot[] {
		return [
			buildSlot({
				slot: 0, itemCategory: ItemCategory.OBJECT, itemId: HOLY_OBJECT_ID
			}),
			buildSlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: HOLY_RANGED_WEAPON_ID
			}),
			buildSlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: UNTAGGED_WEAPON_ID, itemLevel: 2, itemEnchantmentId: "pvpAttack1"
			}),
			buildSlot({
				slot: 1, itemCategory: ItemCategory.ARMOR, itemId: 4
			}),
			buildSlot({
				slot: 0, itemCategory: ItemCategory.ARMOR, itemId: 5, itemLevel: 1
			}),
			buildSlot({
				slot: 0, itemCategory: ItemCategory.POTION, itemId: 6
			})
		];
	}

	describe("getOfPlayer", () => {
		it("should return the stored slots of the player", async () => {
			const slots = inventory();
			const findAll = vi.spyOn(InventorySlot, "findAll").mockResolvedValue(slots);
			const bulkCreate = vi.spyOn(InventorySlot, "bulkCreate");

			expect(await InventorySlots.getOfPlayer(7)).toBe(slots);
			expect(findAll).toHaveBeenCalledWith({ where: { playerId: 7 } });
			expect(bulkCreate).not.toHaveBeenCalled();
		});

		it("should create an empty main slot of every category for a new player", async () => {
			vi.spyOn(InventorySlot, "findAll").mockResolvedValue([]);
			const created = inventory();
			const bulkCreate = vi.spyOn(InventorySlot, "bulkCreate").mockResolvedValue(created);

			expect(await InventorySlots.getOfPlayer(7)).toBe(created);
			expect(bulkCreate).toHaveBeenCalledWith([0, 1, 2, 3].map(itemCategory => ({
				playerId: 7,
				itemId: 0,
				slot: 0,
				itemCategory,
				itemLevel: 0,
				itemEnchantmentId: null
			})));
		});
	});

	it.each([
		["getMainWeaponSlot", ItemCategory.WEAPON],
		["getMainArmorSlot", ItemCategory.ARMOR],
		["getMainPotionSlot", ItemCategory.POTION],
		["getMainObjectSlot", ItemCategory.OBJECT]
	] as const)("%s should look for the equipped slot of category %s", async (method, itemCategory) => {
		const slot = buildSlot({ itemCategory });
		const findOne = vi.spyOn(InventorySlot, "findOne").mockResolvedValue(slot);

		expect(await InventorySlots[method](7)).toBe(slot);
		expect(findOne).toHaveBeenCalledWith({
			where: {
				playerId: 7, slot: 0, itemCategory
			}
		});
	});

	it("should look for a given slot of a category", async () => {
		const slot = buildSlot();
		const findOne = vi.spyOn(InventorySlot, "findOne").mockResolvedValue(slot);

		expect(await InventorySlots.getItem(7, 2, ItemCategory.ARMOR)).toBe(slot);
		expect(findOne).toHaveBeenCalledWith({
			where: {
				playerId: 7, slot: 2, itemCategory: ItemCategory.ARMOR
			}
		});
	});

	describe("active objects", () => {
		const expectedActiveObjects = {
			weapon: {
				item: WeaponDataController.instance.getById(UNTAGGED_WEAPON_ID),
				itemLevel: 2,
				itemEnchantmentId: "pvpAttack1"
			},
			armor: {
				item: ArmorDataController.instance.getById(5),
				itemLevel: 1,
				itemEnchantmentId: null
			},
			potion: { item: expect.objectContaining({ id: 6 }) },
			object: { item: expect.objectContaining({ id: HOLY_OBJECT_ID }) }
		};

		it.each([
			["listed first", inventory()],
			["listed last", inventory().reverse()]
		])("should build the active objects from the equipped slots, the backup slots being %s", (_name, slots) => {
			expect(InventorySlots.slotsToActiveObjects(slots)).toEqual(expectedActiveObjects);
		});

		it.each([
			["listed first", inventory()],
			["listed last", inventory().reverse()]
		])("should load the active objects of a player from its equipped slots, the backup slots being %s", async (_name, slots) => {
			vi.spyOn(InventorySlot, "findAll").mockResolvedValue(slots);

			expect(await InventorySlots.getMainSlotsItems(7)).toEqual(expectedActiveObjects);
			expect(await InventorySlots.getPlayerActiveObjects(7)).toEqual(expectedActiveObjects);
		});
	});

	describe("hasItem", () => {
		it("should find an item owned by the player", async () => {
			const findOne = vi.spyOn(InventorySlot, "findOne").mockResolvedValue(buildSlot());

			expect(await InventorySlots.hasItem(7, 83, ItemCategory.WEAPON)).toBe(true);
			expect(findOne).toHaveBeenCalledWith({
				rejectOnEmpty: false,
				where: {
					playerId: 7, itemId: 83, itemCategory: ItemCategory.WEAPON
				}
			});
		});

		it("should not find an item the player does not own", async () => {
			vi.spyOn(InventorySlot, "findOne").mockResolvedValue(null);

			expect(await InventorySlots.hasItem(7, 83, ItemCategory.WEAPON)).toBe(false);
		});
	});

	describe("countObjectsOfPlayer", () => {
		it("should count the items of the player having the tag, whatever their category", async () => {
			const findAll = vi.spyOn(InventorySlot, "findAll").mockResolvedValue([
				...inventory(),
				// Item removed from the data files
				buildSlot({
					slot: 2, itemCategory: ItemCategory.WEAPON, itemId: 99999
				})
			]);

			expect(await InventorySlots.countObjectsOfPlayer(7, ItemConstants.TAGS.HOLY)).toBe(2);
			expect(await InventorySlots.countObjectsOfPlayer(7, ItemConstants.TAGS.RANGED)).toBe(1);
			expect(await InventorySlots.countObjectsOfPlayer(7, ItemConstants.TAGS.FIRE)).toBe(0);
			expect(findAll).toHaveBeenCalledWith({ where: { playerId: 7 } });
		});
	});
});
