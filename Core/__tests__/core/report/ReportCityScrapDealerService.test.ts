import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	ItemCategory, ItemConstants, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { ScrapDealerConstants } from "../../../../Lib/src/constants/ScrapDealerConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { Material } from "../../../src/data/Material";
import { MainItem } from "../../../src/data/MainItem";
import {
	buildScrapDealerData, getScrapDealerMaterials, getScrapDealerMoney, handleScrapDealerRecycleReaction
} from "../../../src/core/report/ReportCityScrapDealerService";
import InventorySlot from "../../../src/core/database/game/models/InventorySlot";
import { WeaponDataController } from "../../../src/data/Weapon";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";
import { crowniclesInstance } from "../../../src/app";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { ArmorDataController } from "../../../src/data/Armor";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { makeInventorySlot } from "./CityPlayerFixture";
import {
	asPlayer, CityHandlerPlayer, describePackets, makeHandlerPlayer
} from "./CityHandlerFixture";

const MONEY_BLESSING_MULTIPLIER = 2;

vi.mock("../../../src/core/blessings/BlessingManager", () => ({
	BlessingManager: {
		getInstance: () => ({
			applyMoneyBlessing: (amount: number): number => amount * MONEY_BLESSING_MULTIPLIER
		})
	}
}));

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: { logScrapDealerRecycle: vi.fn().mockResolvedValue(undefined) }
	}
}));
vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));
vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn().mockResolvedValue(undefined),
	updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined)
}));

class TestMainItem extends MainItem {
	public categoryName = "weapons";

	public readonly rarity: ItemRarity;

	public id = 42;

	public requestedLevels: number[] = [];

	private readonly materialsByLevel: Map<number, Material[]>;

	public constructor(rarity: ItemRarity, materialsByLevel: Map<number, Material[]>) {
		super();
		this.rarity = rarity;
		this.materialsByLevel = materialsByLevel;
	}

	protected getBaseAttack(): number {
		return 0;
	}

	protected getBaseDefense(): number {
		return 0;
	}

	public getAttack(_itemLevel: number): number {
		return 0;
	}

	public getDefense(_itemLevel: number): number {
		return 0;
	}

	public getCategory(): number {
		return ItemCategory.WEAPON;
	}

	public getItemAddedValue(): number {
		return 0;
	}

	public getUpgradeMaterials(level: number): Material[] {
		this.requestedLevels.push(level);
		return this.materialsByLevel.get(level) ?? [];
	}
}

function makeMaterial(id: string, rarity: MaterialRarity = MaterialRarity.COMMON): Material {
	return {
		id, rarity
	} as Material;
}

describe("getScrapDealerMaterials", () => {
	it("gives nothing back for an item without any upgrade recipe", () => {
		const item = new TestMainItem(ItemRarity.COMMON, new Map());

		expect(getScrapDealerMaterials(item, 3)).toEqual([]);
	});

	it("stops as soon as the blacksmith price of the given materials reaches the scaled item value", () => {
		const item = new TestMainItem(ItemRarity.COMMON, new Map([[1, [
			makeMaterial("10"),
			makeMaterial("11"),
			makeMaterial("12"),
			makeMaterial("13")
		]]]));

		expect(getScrapDealerMaterials(item, 1)).toEqual([{
			materialId: 10, quantity: 1
		}]);
	});

	it("keeps the rarity mix of the item recipe instead of draining the common materials first", () => {
		const item = new TestMainItem(ItemRarity.EPIC, new Map([[1, [
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("20", MaterialRarity.UNCOMMON),
			makeMaterial("20", MaterialRarity.UNCOMMON),
			makeMaterial("30", MaterialRarity.RARE)
		]]]));

		expect(getScrapDealerMaterials(item, 0).map(material => material.materialId)).toEqual([
			10, 20, 30
		]);
	});

	it("keeps materials from every reached upgrade level in the recovery cycle", () => {
		const item = new TestMainItem(ItemRarity.EXOTIC, new Map([
			[1, Array.from({ length: 4 }, () => makeMaterial("10"))],
			[2, Array.from({ length: 4 }, () => makeMaterial("20"))],
			[3, Array.from({ length: 4 }, () => makeMaterial("30"))],
			[4, Array.from({ length: 4 }, () => makeMaterial("5"))]
		]));

		const recoveredMaterialIds = getScrapDealerMaterials(item, 4)
			.map(material => material.materialId);

		expect(recoveredMaterialIds).toEqual(expect.arrayContaining([5, 10, 20, 30]));
	});

	it("hands out materials worth the item value scaled by its upgrade level", () => {
		const rarityByMaterialId = new Map([
			[10, MaterialRarity.COMMON],
			[20, MaterialRarity.UNCOMMON]
		]);
		const givenPrice = (itemLevel: number): number => {
			const item = new TestMainItem(ItemRarity.EPIC, new Map([
				[1, [makeMaterial("10"), makeMaterial("20", MaterialRarity.UNCOMMON)]],
				[2, [makeMaterial("10"), makeMaterial("20", MaterialRarity.UNCOMMON)]]
			]));
			return getMaterialsPurchasePrice(getScrapDealerMaterials(item, itemLevel).map(material => ({
				rarity: rarityByMaterialId.get(material.materialId)!,
				quantity: material.quantity
			})));
		};
		const epicValue = ItemConstants.RARITY.VALUES[ItemRarity.EPIC];

		expect(givenPrice(0)).toBeGreaterThanOrEqual(epicValue * ScrapDealerConstants.BASE_VALUE_MULTIPLIER);
		expect(givenPrice(2)).toBeGreaterThanOrEqual(epicValue
			* (ScrapDealerConstants.BASE_VALUE_MULTIPLIER + 2 * ScrapDealerConstants.VALUE_MULTIPLIER_PER_LEVEL));
		expect(givenPrice(2)).toBeGreaterThan(givenPrice(0));
	});
});

describe("getScrapDealerMoney", () => {
	it("gives back a share of the item sell price, blessing included", () => {
		const item = new TestMainItem(ItemRarity.EPIC, new Map());

		expect(getScrapDealerMoney(item)).toBe(Math.round(
			ItemConstants.RARITY.VALUES[ItemRarity.EPIC] * ScrapDealerConstants.MONEY_VALUE_RATIO
		) * MONEY_BLESSING_MULTIPLIER);
	});
});

describe("scrap dealer menu and recycling", () => {
	// Real item data: the rare weapon 11 has an upgrade recipe, its sell value is the rare rarity value plus its stats value
	const RARE_WEAPON_ID = 11;
	const rareWeapon = WeaponDataController.instance.getById(RARE_WEAPON_ID);
	const logs = crowniclesInstance?.logsDatabase;

	function backupWeapon(slot = 1, itemEnchantmentId: string | null = null, itemLevel = 0): InventorySlot {
		return makeInventorySlot({
			slot, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemEnchantmentId, itemLevel
		});
	}

	function lockPlayer(player: CityHandlerPlayer): void {
		vi.mocked(withLockedPlayerAndMissions).mockImplementation((_playerId, callback) => callback(asPlayer(player)));
	}

	async function recycle(player: CityHandlerPlayer, data: ReactionCollectorCityData, itemId = RARE_WEAPON_ID): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleScrapDealerRecycleReaction(asPlayer(player), {
			slot: 1, itemCategory: ItemCategory.WEAPON, itemId
		}, data, response);
		return response;
	}

	function openScrapDealer(player: CityHandlerPlayer, slots: InventorySlot[]): ReactionCollectorCityData {
		// The scrap dealer handler only reads the scrap dealer part of the city data
		return { scrapDealer: buildScrapDealerData(slots, asPlayer(player)) } as ReactionCollectorCityData;
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists the unequipped and unenchanted weapons and armors with what recycling them gives back", () => {
		if (!rareWeapon) {
			throw new Error("Missing weapon data");
		}
		const player = makeHandlerPlayer(0);
		const data = buildScrapDealerData([
			backupWeapon(1, null, 2),
			backupWeapon(0),
			backupWeapon(2, ItemEnchantment.PVE_ATTACK_1.id),
			makeInventorySlot({
				slot: 1, itemCategory: ItemCategory.POTION, itemId: 1
			}),
			makeInventorySlot({
				slot: 3, itemCategory: ItemCategory.WEAPON, itemId: 0
			})
		], asPlayer(player));

		expect(data.recyclableItems).toHaveLength(1);
		expect(data.recyclableItems[0]).toMatchObject({
			slot: 1,
			category: ItemCategory.WEAPON,
			itemId: RARE_WEAPON_ID,
			recoveredMaterials: getScrapDealerMaterials(rareWeapon, 2),
			recoveredMoney: getScrapDealerMoney(rareWeapon)
		});
		expect(data.recyclableItems[0].details.itemLevel).toBe(2);
	});

	it("deletes the equipment and credits exactly the listed materials and coins, without applying the blessing twice", async () => {
		const player = makeHandlerPlayer(0);
		const slot = backupWeapon();
		const data = openScrapDealer(player, [slot]);
		const listed = data.scrapDealer?.recyclableItems[0];
		vi.spyOn(InventorySlot, "findOne").mockResolvedValue(slot);
		const destroy = vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);
		lockPlayer(player);

		const response = await recycle(player, data);

		const filter = {
			where: {
				playerId: player.id, slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
			}
		};
		expect(InventorySlot.findOne).toHaveBeenCalledWith(filter);
		expect(destroy).toHaveBeenCalledWith(filter);
		expect(applyMaterialLoot).toHaveBeenCalledWith(player.id, listed?.recoveredMaterials);
		expect(updateCollectMaterialsMission).toHaveBeenCalledWith(player, response, listed?.recoveredMaterials);
		expect(player.addMoney).toHaveBeenCalledWith({
			response, amount: listed?.recoveredMoney, reason: NumberChangeReason.SCRAP_DEALER_RECYCLE, ignoreBlessing: true
		});
		expect(player.money).toBe(listed?.recoveredMoney);
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportScrapDealerRecycleRes", {
			materialLoot: listed?.recoveredMaterials, moneyGained: listed?.recoveredMoney
		}]]);
		expect(logs?.logScrapDealerRecycle).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: "boug_coton", itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemLevel: 0, slot: 1
		});
	});

	it("pays nothing when a concurrent recycle already deleted the equipment", async () => {
		const player = makeHandlerPlayer(0);
		const slot = backupWeapon();
		const data = openScrapDealer(player, [slot]);
		vi.spyOn(InventorySlot, "findOne").mockResolvedValue(slot);
		vi.spyOn(InventorySlot, "destroy").mockResolvedValue(0);
		lockPlayer(player);

		const response = await recycle(player, data);

		expect(response).toEqual([]);
		expect(applyMaterialLoot).not.toHaveBeenCalled();
		expect(player.addMoney).not.toHaveBeenCalled();
	});

	it("recycles nothing that became equipped, enchanted or disappeared since the menu was opened", async () => {
		const player = makeHandlerPlayer(0);
		const data = openScrapDealer(player, [backupWeapon()]);
		const destroy = vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);
		lockPlayer(player);

		for (const current of [backupWeapon(0), backupWeapon(1, ItemEnchantment.PVE_ATTACK_1.id), null]) {
			vi.spyOn(InventorySlot, "findOne").mockResolvedValue(current);
			expect(await recycle(player, data)).toEqual([]);
		}
		expect(destroy).not.toHaveBeenCalled();
		expect(player.addMoney).not.toHaveBeenCalled();
	});

	it("ignores an equipment the scrap dealer did not list, without locking", async () => {
		const player = makeHandlerPlayer(0);
		const data = openScrapDealer(player, [backupWeapon()]);

		const otherItem = await recycle(player, data, RARE_WEAPON_ID + 1);
		const noScrapDealer = await recycle(player, {} as ReactionCollectorCityData);

		expect([...otherItem, ...noScrapDealer]).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("does not log a recycling made outside of a city", async () => {
		const player = makeHandlerPlayer(0);
		player.getCurrentCityId.mockReturnValue(null);
		const slot = backupWeapon();
		const data = openScrapDealer(player, [slot]);
		vi.spyOn(InventorySlot, "findOne").mockResolvedValue(slot);
		vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);
		lockPlayer(player);

		await recycle(player, data);

		expect(player.addMoney).toHaveBeenCalled();
		expect(logs?.logScrapDealerRecycle).not.toHaveBeenCalled();
	});
});

describe("scrap dealer economy", () => {
	/**
	 * Average of a value over the equipments the general shop can draw, weighted by the rarity generator
	 */
	function averageOverRandomEquipments(value: (item: MainItem) => number): number {
		const thresholds = ItemConstants.RARITY.GENERATOR.VALUES;
		let average = 0;
		for (const controller of [WeaponDataController.instance, ArmorDataController.instance]) {
			for (let rarity = ItemRarity.COMMON; rarity <= ItemRarity.MYTHICAL; rarity++) {
				const ids = controller.getAllIdsForRarity(rarity);
				const rarityChance = (thresholds[rarity - 1] - (thresholds[rarity - 2] ?? 0)) / ItemConstants.RARITY.GENERATOR.MAX_VALUE;
				const items: MainItem[] = ids.flatMap(id => controller.getById(id) ?? []);
				average += rarityChance * items.reduce((sum, item) => sum + value(item), 0) / items.length / 2;
			}
		}
		return average;
	}

	it("does not make buying random equipments to scrap them a cheaper source of materials or coins than the shops", () => {
		// Half of the random items are potions or objects, which cannot be scrapped; the level 2 is the best looted level
		const equipmentShare = 2 / 4;
		const materials = equipmentShare * averageOverRandomEquipments(item => getScrapDealerMaterials(item, 2).reduce((sum, material) => sum + material.quantity, 0));
		const coins = equipmentShare * averageOverRandomEquipments(item => getScrapDealerMoney(item)) / MONEY_BLESSING_MULTIPLIER;

		expect(materials * ShopConstants.MATERIAL_MERCHANT_PRICE_PER_UNIT + coins).toBeLessThan(ShopConstants.RANDOM_ITEM_PRICE);
	});
});
