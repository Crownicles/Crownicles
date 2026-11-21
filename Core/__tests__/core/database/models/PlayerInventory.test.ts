import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { Sequelize } from "sequelize";
import InventorySlot, {
	initModel as initInventorySlot, InventorySlots
} from "../../../../src/core/database/game/models/InventorySlot";
import InventoryInfo, {
	initModel as initInventoryInfo, InventoryInfos
} from "../../../../src/core/database/game/models/InventoryInfo";
import Home, { Homes } from "../../../../src/core/database/game/models/Home";
import { WeaponDataController } from "../../../../src/data/Weapon";
import { PotionDataController } from "../../../../src/data/Potion";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { ItemCategory } from "../../../../../Lib/src/constants/ItemConstants";
import { InventoryConstants } from "../../../../../Lib/src/constants/InventoryConstants";
import {
	buildPlayer, PLAYER_ID, useLogsDatabase
} from "./PlayerRowFixture";

const sequelize = new Sequelize({
	dialect: "mariadb",
	logging: false
});
initInventorySlot(sequelize);
initInventoryInfo(sequelize);

type SlotValues = {
	itemCategory: ItemCategory;
	slot: number;
	itemId: number;
};

function inventorySlot(values: SlotValues): InventorySlot {
	return InventorySlot.build({
		playerId: PLAYER_ID,
		itemLevel: 0,
		itemEnchantmentId: null,
		remainingPotionUsages: null,
		...values
	}, { isNewRecord: false });
}

function requireItem<T>(item: T | undefined): T {
	if (!item) {
		throw new Error("Missing item in the game data");
	}
	return item;
}

describe("Player inventory", () => {
	let slots: InventorySlot[];
	let inventoryInfo: InventoryInfo;
	let home: Home | null;
	let create: ReturnType<typeof vi.spyOn>;
	let update: ReturnType<typeof vi.spyOn>;

	const weapon = requireItem(WeaponDataController.instance.getById(5));
	const potion = requireItem(PotionDataController.instance.getById(3));

	beforeEach(() => {
		slots = [];
		home = null;
		inventoryInfo = InventoryInfo.build({
			playerId: PLAYER_ID,
			weaponSlots: 2,
			armorSlots: 1,
			potionSlots: 3,
			objectSlots: 1
		}, { isNewRecord: false });
		vi.spyOn(InventorySlots, "getOfPlayer").mockImplementation(() => Promise.resolve(slots));
		vi.spyOn(InventoryInfos, "getOfPlayer").mockImplementation(() => Promise.resolve(inventoryInfo));
		vi.spyOn(Homes, "getOfPlayer").mockImplementation(() => Promise.resolve(home));
		create = vi.spyOn(InventorySlot, "create").mockResolvedValue({} as InventorySlot);
		update = vi.spyOn(InventorySlot, "update").mockResolvedValue([1]);
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.restoreAllMocks();
	});

	function homeWithInventoryBonus(weaponBonus: number): Home {
		// Only the inventory bonus of the home level is read when giving an item
		return {
			getLevel: () => ({
				features: {
					inventoryBonus: {
						weapon: weaponBonus, armor: 0, potion: 0, object: 0
					}
				}
			})
		} as unknown as Home;
	}

	describe("giveItem", () => {
		it("equips the item when the equipped slot of its category is empty", async () => {
			slots = [inventorySlot({
				itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 0
			})];

			expect(await buildPlayer().giveItem(weapon, 4, "enchantmentId")).toBe(true);

			expect(update).toHaveBeenCalledWith({
				itemId: weapon.id,
				itemLevel: 4,
				itemEnchantmentId: "enchantmentId",
				remainingPotionUsages: null
			}, {
				where: {
					playerId: PLAYER_ID,
					itemCategory: ItemCategory.WEAPON,
					slot: 0
				}
			});
			expect(create).not.toHaveBeenCalled();
		});

		it("does not equip the item in the empty equipped slot of another category", async () => {
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.ARMOR, slot: 0, itemId: 0
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 1, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(weapon)).toBe(false);

			expect(update).not.toHaveBeenCalled();
		});

		it("stores the item in the first free backup slot of its category", async () => {
			inventoryInfo.potionSlots = 4;
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.POTION, slot: 0, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.POTION, slot: 1, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.POTION, slot: 3, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 2, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(potion, 4, "enchantmentId")).toBe(true);

			expect(create).toHaveBeenCalledWith({
				playerId: PLAYER_ID,
				itemCategory: ItemCategory.POTION,
				slot: 2,
				itemId: potion.id,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null
			});
			expect(update).not.toHaveBeenCalled();
		});

		it("refuses the item when every slot of its category is taken", async () => {
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 1, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(weapon)).toBe(false);

			expect(create).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it("ignores the slots beyond the limit of the category", async () => {
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 2, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(weapon)).toBe(true);

			expect(create).toHaveBeenCalledWith(expect.objectContaining({
				slot: 1, itemLevel: 0, itemEnchantmentId: null
			}));
		});

		it("adds the inventory bonus of the home to the slots of the category", async () => {
			home = homeWithInventoryBonus(1);
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 1, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(weapon)).toBe(true);

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ slot: 2 }));
		});

		it("refuses the item when the home has no inventory bonus and the slots are taken", async () => {
			home = homeWithInventoryBonus(0);
			slots = [
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 0, itemId: 7
				}),
				inventorySlot({
					itemCategory: ItemCategory.WEAPON, slot: 1, itemId: 7
				})
			];

			expect(await buildPlayer().giveItem(weapon)).toBe(false);
		});
	});

	describe("drinkPotion", () => {
		function stubPotionLookup(): ReturnType<typeof vi.fn> {
			const logItemSell = vi.fn().mockResolvedValue(undefined);
			useLogsDatabase({ logItemSell });
			vi.spyOn(InventorySlot, "findOne").mockResolvedValue(inventorySlot({
				itemCategory: ItemCategory.POTION, slot: 0, itemId: potion.id
			}));
			return logItemSell;
		}

		it("replaces the equipped potion by the default one", async () => {
			const logItemSell = stubPotionLookup();
			const destroy = vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);

			await buildPlayer().drinkPotion(0);

			expect(update).toHaveBeenCalledWith({ itemId: InventoryConstants.POTION_DEFAULT_ID }, {
				where: {
					slot: 0,
					itemCategory: ItemCategory.POTION,
					playerId: PLAYER_ID
				}
			});
			expect(destroy).not.toHaveBeenCalled();
			expect(InventorySlot.findOne).toHaveBeenCalledWith({
				where: {
					playerId: PLAYER_ID,
					slot: 0,
					itemCategory: ItemCategory.POTION
				}
			});
			await vi.waitFor(() => expect(logItemSell).toHaveBeenCalledWith("keycloak-7", potion));
		});

		it("does not log a potion that is no longer in the inventory", async () => {
			const logItemSell = vi.fn().mockResolvedValue(undefined);
			useLogsDatabase({ logItemSell });
			const findOne = vi.spyOn(InventorySlot, "findOne").mockResolvedValue(null);
			vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);

			await buildPlayer().drinkPotion(1);
			await findOne.mock.results[0].value;
			await new Promise(resolve => setImmediate(resolve));

			expect(logItemSell).not.toHaveBeenCalled();
		});

		it("removes a backup potion", async () => {
			stubPotionLookup();
			const destroy = vi.spyOn(InventorySlot, "destroy").mockResolvedValue(1);

			await buildPlayer().drinkPotion(2);

			expect(destroy).toHaveBeenCalledWith({
				where: {
					playerId: PLAYER_ID,
					slot: 2,
					itemCategory: ItemCategory.POTION
				}
			});
			expect(update).not.toHaveBeenCalled();
		});
	});
});
