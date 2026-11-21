import {
	describe, expect, it
} from "vitest";
import {
	buildBlacksmithData, buildDisenchantableItems, getBlacksmithItemData
} from "../../../src/core/report/ReportBlacksmithService";
import {
	ItemCategory, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { BlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	makeCityPlayer, makeInventorySlot
} from "./CityPlayerFixture";

/*
 * Real item data: the rare weapon 11 needs materials 7, 7, 34, 21 and 77 (all common) for its first upgrade,
 * the common weapon 2 needs materials 24 and 70, and the common armor 2 needs materials 20 and 79
 */
const RARE_WEAPON_ID = 11;
const COMMON_WEAPON_ID = 2;
const COMMON_ARMOR_ID = 2;

// round(50 * (1 + (RARE - EPIC) * 9%))
const RARE_FIRST_UPGRADE_PRICE = 41;

// round(3500 * (1 + (COMMON - EPIC) * 9%))
const COMMON_FOURTH_UPGRADE_PRICE = 1925;

// Three common materials bought in a row: 340, 374 and 408
const THREE_COMMON_MATERIALS_PRICE = 1122;

const RICH = 1_000_000;

function rareWeapon(itemLevel = 0): ReturnType<typeof makeInventorySlot> {
	return makeInventorySlot({
		slot: 0, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemLevel
	});
}

describe("getBlacksmithItemData", () => {
	it("resolves weapons and armors to their own data and refuses the other slots", () => {
		expect(getBlacksmithItemData(rareWeapon())?.rarity).toBe(ItemRarity.RARE);
		expect(getBlacksmithItemData(makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID
		}))?.categoryName).toBe("armors");
		expect(getBlacksmithItemData(makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.WEAPON, itemId: 0
		}))).toBeNull();
		expect(getBlacksmithItemData(makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.POTION, itemId: 1
		}))).toBeNull();
	});
});

describe("buildBlacksmithData upgrades", () => {
	it("aggregates the required materials, prices the missing ones and allows buying them when the player can pay everything", () => {
		const player = makeCityPlayer(RARE_FIRST_UPGRADE_PRICE + THREE_COMMON_MATERIALS_PRICE);
		const data = buildBlacksmithData([rareWeapon()], new Map([[7, 1], [34, 1]]), player);

		expect(data.playerMoney).toBe(player.money);
		expect(data.upgradeableItems).toHaveLength(1);
		const [item] = data.upgradeableItems;
		expect(item).toMatchObject({
			slot: 0,
			category: ItemCategory.WEAPON,
			nextLevel: 1,
			upgradeCost: RARE_FIRST_UPGRADE_PRICE,
			missingMaterialsCost: THREE_COMMON_MATERIALS_PRICE,
			hasAllMaterials: false,
			canUpgrade: false,
			canBuyAndUpgrade: true
		});
		expect(item.details.id).toBe(RARE_WEAPON_ID);
		expect(item.requiredMaterials).toEqual([
			{
				materialId: 7, rarity: MaterialRarity.COMMON, quantity: 2, playerQuantity: 1
			},
			{
				materialId: 34, rarity: MaterialRarity.COMMON, quantity: 1, playerQuantity: 1
			},
			{
				materialId: 21, rarity: MaterialRarity.COMMON, quantity: 1, playerQuantity: 0
			},
			{
				materialId: 77, rarity: MaterialRarity.COMMON, quantity: 1, playerQuantity: 0
			}
		]);
	});

	it("refuses buying the missing materials when one coin is missing", () => {
		const data = buildBlacksmithData([rareWeapon()], new Map([[7, 1], [34, 1]]), makeCityPlayer(RARE_FIRST_UPGRADE_PRICE + THREE_COMMON_MATERIALS_PRICE - 1));

		expect(data.upgradeableItems[0]).toMatchObject({
			canUpgrade: false, canBuyAndUpgrade: false
		});
	});

	it("allows the upgrade with exactly the upgrade price when the player owns every material, and never sells materials then", () => {
		const materials = new Map([[7, 2], [34, 5], [21, 1], [77, 1]]);
		const [affordable] = buildBlacksmithData([rareWeapon()], materials, makeCityPlayer(RARE_FIRST_UPGRADE_PRICE)).upgradeableItems;
		const [tooExpensive] = buildBlacksmithData([rareWeapon()], materials, makeCityPlayer(RARE_FIRST_UPGRADE_PRICE - 1)).upgradeableItems;

		expect(affordable).toMatchObject({
			hasAllMaterials: true, missingMaterialsCost: 0, canUpgrade: true, canBuyAndUpgrade: false
		});
		expect(tooExpensive).toMatchObject({
			hasAllMaterials: true, canUpgrade: false, canBuyAndUpgrade: false
		});
	});

	it("lists the items below the maximum level only, with the price of their next level", () => {
		const inventory = [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemLevel: BlacksmithConstants.MAX_UPGRADE_LEVEL - 1
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemLevel: BlacksmithConstants.MAX_UPGRADE_LEVEL
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

		const data = buildBlacksmithData(inventory, new Map(), makeCityPlayer(RICH));

		expect(data.upgradeableItems.map(item => [item.category, item.slot, item.nextLevel])).toEqual([
			[ItemCategory.WEAPON, 0, BlacksmithConstants.MAX_UPGRADE_LEVEL],
			[ItemCategory.ARMOR, 0, 1]
		]);
		expect(data.upgradeableItems[0].upgradeCost).toBe(COMMON_FOURTH_UPGRADE_PRICE);
		expect(data.upgradeableItems[1].requiredMaterials.map(material => material.materialId)).toEqual([20, 79]);
	});
});

describe("buildBlacksmithData enchantment transfers", () => {
	const enchantedWeapon = makeInventorySlot({
		slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemEnchantmentId: ItemEnchantment.PVE_ATTACK_1.id
	});
	const rareTarget = makeInventorySlot({
		slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
	});
	const enchantedArmor = makeInventorySlot({
		slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID, itemEnchantmentId: ItemEnchantment.DEFENSE_1.id
	});
	const rareTransferPrice = BlacksmithConstants.ENCHANTMENT_TRANSFER_PRICE[ItemRarity.RARE];

	it("offers each enchanted equipment the unenchanted equipments of its category, priced by the receiving rarity", () => {
		const data = buildBlacksmithData([enchantedWeapon, rareTarget, enchantedArmor], new Map(), makeCityPlayer(rareTransferPrice));

		expect(data.enchantmentTransfers).toHaveLength(1);
		const [source] = data.enchantmentTransfers;
		expect(source).toMatchObject({
			slot: 0,
			category: ItemCategory.WEAPON,
			enchantmentId: ItemEnchantment.PVE_ATTACK_1.id,
			enchantmentType: ItemEnchantment.PVE_ATTACK_1.kind.type.id
		});
		expect(source.targets.map(target => [target.slot, target.details.id, target.cost, target.canAfford])).toEqual([[1, RARE_WEAPON_ID, rareTransferPrice, true]]);
	});

	it("marks the transfer unaffordable when one coin is missing", () => {
		const data = buildBlacksmithData([enchantedWeapon, rareTarget], new Map(), makeCityPlayer(rareTransferPrice - 1));

		expect(data.enchantmentTransfers[0].targets[0].canAfford).toBe(false);
	});
});

describe("buildDisenchantableItems", () => {
	it("lists the weapons and armors carrying a known enchantment", () => {
		const inventory = [
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemEnchantmentId: ItemEnchantment.PVE_ATTACK_1.id
			}),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
			}),
			makeInventorySlot({
				slot: 2, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemEnchantmentId: "unknownEnchantment"
			}),
			makeInventorySlot({
				slot: 3, itemCategory: ItemCategory.WEAPON, itemId: 0, itemEnchantmentId: ItemEnchantment.PVE_ATTACK_1.id
			}),
			makeInventorySlot({
				slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID, itemEnchantmentId: ItemEnchantment.DEFENSE_1.id
			})
		];

		const items = buildDisenchantableItems(inventory, makeCityPlayer(0));

		expect(items.map(item => [item.category, item.slot, item.details.id, item.enchantmentId, item.enchantmentType])).toEqual([
			[ItemCategory.WEAPON, 0, COMMON_WEAPON_ID, ItemEnchantment.PVE_ATTACK_1.id, ItemEnchantment.PVE_ATTACK_1.kind.type.id],
			[ItemCategory.ARMOR, 0, COMMON_ARMOR_ID, ItemEnchantment.DEFENSE_1.id, ItemEnchantment.DEFENSE_1.kind.type.id]
		]);
	});
});
