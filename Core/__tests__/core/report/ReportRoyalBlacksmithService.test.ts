import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	PlayerMissionsInfos: {
		getOfPlayer: vi.fn()
	}
}));

import { buildRoyalBlacksmithData } from "../../../src/core/report/ReportRoyalBlacksmithService";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { RoyalBlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	makeCityPlayer, makeInventorySlot
} from "./CityPlayerFixture";

/*
 * Real item data: the rare weapon 11 needs, for its level 5, the common materials 35 x2, 1 x2, 82 x2, 7 x2 and 34,
 * the uncommon materials 53 x3 and 13 x2 and the rare materials 28 x2 and 83
 */
const RARE_WEAPON_ID = 11;
const COMMON_ARMOR_ID = 2;

// round(7500 * (1 + (RARE - EPIC) * 9%))
const RARE_ROYAL_UPGRADE_PRICE = 6150;
const RARE_GEM_COST = 4;

const ALL_MATERIALS = new Map([[35, 2], [1, 2], [82, 2], [7, 2], [34, 1], [53, 3], [13, 2], [28, 2], [83, 1]]);

// Missing one material 28 and the material 83, two rare materials bought in a row: 3650 and 4015
const MISSING_TWO_RARE_MATERIALS = new Map([...ALL_MATERIALS, [28, 1], [83, 0]]);
const TWO_RARE_MATERIALS_PRICE = 7665;

const WORTHY_LEVEL = RoyalBlacksmithConstants.MIN_PLAYER_LEVEL;
const TARGET = RoyalBlacksmithConstants.TARGET_LEVEL;

function weapon(itemLevel: number, slot = 0): ReturnType<typeof makeInventorySlot> {
	return makeInventorySlot({
		slot, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemLevel
	});
}

function armor(itemLevel: number): ReturnType<typeof makeInventorySlot> {
	return makeInventorySlot({
		slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID, itemLevel
	});
}

function givePlayerGems(gems: number): void {
	vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ gems } as PlayerMissionsInfo);
}

describe("buildRoyalBlacksmithData", () => {
	beforeEach(() => {
		givePlayerGems(RARE_GEM_COST);
	});

	it("refuses a player below the minimum level, whatever the inventory", async () => {
		const player = makeCityPlayer(1234, WORTHY_LEVEL - 1);

		expect(await buildRoyalBlacksmithData([weapon(TARGET - 1)], ALL_MATERIALS, player)).toEqual({
			status: "not_worthy",
			playerLevel: WORTHY_LEVEL - 1,
			upgradeableItems: [],
			playerMoney: 1234,
			playerGems: RARE_GEM_COST
		});
	});

	it("lists only the items one level below the target, with their money, gem and material costs", async () => {
		const player = makeCityPlayer(RARE_ROYAL_UPGRADE_PRICE, WORTHY_LEVEL);

		const data = await buildRoyalBlacksmithData([weapon(TARGET - 1), weapon(TARGET - 2, 1), armor(TARGET)], ALL_MATERIALS, player);

		expect(data).toMatchObject({
			status: "ready", playerLevel: WORTHY_LEVEL, playerMoney: RARE_ROYAL_UPGRADE_PRICE, playerGems: RARE_GEM_COST
		});
		expect(data.upgradeableItems).toHaveLength(1);
		const [item] = data.upgradeableItems;
		expect(item).toMatchObject({
			slot: 0,
			category: ItemCategory.WEAPON,
			upgradeCost: RARE_ROYAL_UPGRADE_PRICE,
			gemCost: RARE_GEM_COST,
			itemRarity: 4,
			missingMaterialsCost: 0,
			hasAllMaterials: true,
			canUpgrade: true,
			canBuyAndUpgrade: false
		});
		expect(item.details.id).toBe(RARE_WEAPON_ID);
		expect(item.requiredMaterials.map(material => [material.materialId, material.rarity, material.quantity, material.playerQuantity])).toEqual([
			[35, MaterialRarity.COMMON, 2, 2],
			[1, MaterialRarity.COMMON, 2, 2],
			[82, MaterialRarity.COMMON, 2, 2],
			[7, MaterialRarity.COMMON, 2, 2],
			[34, MaterialRarity.COMMON, 1, 1],
			[53, MaterialRarity.UNCOMMON, 3, 3],
			[13, MaterialRarity.UNCOMMON, 2, 2],
			[28, MaterialRarity.RARE, 2, 2],
			[83, MaterialRarity.RARE, 1, 1]
		]);
	});

	it("refuses the upgrade when one coin or one gem is missing", async () => {
		const [poor] = (await buildRoyalBlacksmithData([weapon(TARGET - 1)], ALL_MATERIALS, makeCityPlayer(RARE_ROYAL_UPGRADE_PRICE - 1, WORTHY_LEVEL))).upgradeableItems;
		givePlayerGems(RARE_GEM_COST - 1);
		const [noGems] = (await buildRoyalBlacksmithData([weapon(TARGET - 1)], ALL_MATERIALS, makeCityPlayer(RARE_ROYAL_UPGRADE_PRICE, WORTHY_LEVEL))).upgradeableItems;

		expect(poor.canUpgrade).toBe(false);
		expect(noGems.canUpgrade).toBe(false);
		expect(noGems.canBuyAndUpgrade).toBe(false);
	});

	it("prices the missing materials and allows buying them only when money and gems cover everything", async () => {
		const exactMoney = RARE_ROYAL_UPGRADE_PRICE + TWO_RARE_MATERIALS_PRICE;

		const [item] = (await buildRoyalBlacksmithData([weapon(TARGET - 1)], MISSING_TWO_RARE_MATERIALS, makeCityPlayer(exactMoney, WORTHY_LEVEL))).upgradeableItems;
		const [poor] = (await buildRoyalBlacksmithData([weapon(TARGET - 1)], MISSING_TWO_RARE_MATERIALS, makeCityPlayer(exactMoney - 1, WORTHY_LEVEL))).upgradeableItems;
		givePlayerGems(RARE_GEM_COST - 1);
		const [noGems] = (await buildRoyalBlacksmithData([weapon(TARGET - 1)], MISSING_TWO_RARE_MATERIALS, makeCityPlayer(exactMoney, WORTHY_LEVEL))).upgradeableItems;

		expect(item).toMatchObject({
			hasAllMaterials: false, missingMaterialsCost: TWO_RARE_MATERIALS_PRICE, canUpgrade: false, canBuyAndUpgrade: true
		});
		expect(item.requiredMaterials.filter(material => material.playerQuantity < material.quantity).map(material => [material.materialId, material.playerQuantity]))
			.toEqual([[28, 1], [83, 0]]);
		expect(poor.canBuyAndUpgrade).toBe(false);
		expect(noGems.canBuyAndUpgrade).toBe(false);
	});

	it("tells a worthy player that every equipment is already at the target level", async () => {
		const data = await buildRoyalBlacksmithData([weapon(TARGET), armor(TARGET)], ALL_MATERIALS, makeCityPlayer(7, WORTHY_LEVEL));

		expect(data).toEqual({
			status: "all_maxed", playerLevel: WORTHY_LEVEL, upgradeableItems: [], playerMoney: 7, playerGems: RARE_GEM_COST
		});
	});

	it("tells a worthy player that the equipments are too low when none is one level below the target", async () => {
		const mixed = await buildRoyalBlacksmithData([weapon(TARGET), armor(TARGET - 2)], ALL_MATERIALS, makeCityPlayer(7, WORTHY_LEVEL));
		const empty = await buildRoyalBlacksmithData([], ALL_MATERIALS, makeCityPlayer(7, WORTHY_LEVEL));

		for (const data of [mixed, empty]) {
			expect(data).toEqual({
				status: "items_too_low", playerLevel: WORTHY_LEVEL, upgradeableItems: [], playerMoney: 7, playerGems: RARE_GEM_COST
			});
		}
	});
});
