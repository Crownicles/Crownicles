import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { PlayerActiveObjects } from "./PlayerActiveObjects";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import { GenericItem } from "../../../../data/GenericItem";
import {
	Armor, ArmorDataController
} from "../../../../data/Armor";
import {
	Weapon, WeaponDataController
} from "../../../../data/Weapon";
import {
	Potion, PotionDataController
} from "../../../../data/Potion";
import {
	ObjectItem, ObjectItemDataController
} from "../../../../data/ObjectItem";
import Player from "./Player";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { InventoryConstants } from "../../../../../../Lib/src/constants/InventoryConstants";

type DepositCandidate = {
	slot: InventorySlot;
	freeSlot: number;
};

export class InventorySlot extends Model {
	declare readonly playerId: number;

	declare slot: number;

	declare itemCategory: number;

	declare itemId: number;

	declare remainingPotionUsages: number;

	declare updatedAt: Date;

	declare createdAt: Date;


	getItem(): GenericItem | null {
		switch (this.itemCategory) {
			case ItemCategory.WEAPON:
				return WeaponDataController.instance.getById(this.itemId) ?? null;
			case ItemCategory.ARMOR:
				return ArmorDataController.instance.getById(this.itemId) ?? null;
			case ItemCategory.POTION:
				return PotionDataController.instance.getById(this.itemId) ?? null;
			case ItemCategory.OBJECT:
				return ObjectItemDataController.instance.getById(this.itemId) ?? null;
			default:
				return null;
		}
	}

	isEquipped(): boolean {
		return this.slot === 0;
	}

	isWeapon(): boolean {
		return this.itemCategory === ItemCategory.WEAPON;
	}

	isArmor(): boolean {
		return this.itemCategory === ItemCategory.ARMOR;
	}

	isPotion(): boolean {
		return this.itemCategory === ItemCategory.POTION;
	}

	isObject(): boolean {
		return this.itemCategory === ItemCategory.OBJECT;
	}
}

export abstract class InventorySlots {
	public static async getOfPlayer(playerId: number): Promise<InventorySlot[]> {
		const slots: InventorySlot[] = await InventorySlot.findAll({
			where: { playerId }
		});
		if (slots.length === 0) {
			return await InventorySlot.bulkCreate(
				[
					{
						playerId,
						itemId: 0,
						slot: 0,
						itemCategory: 0
					},
					{
						playerId,
						itemId: 0,
						slot: 0,
						itemCategory: 1
					},
					{
						playerId,
						itemId: 0,
						slot: 0,
						itemCategory: 2
					},
					{
						playerId,
						itemId: 0,
						slot: 0,
						itemCategory: 3
					}
				]
			);
		}
		return slots;
	}

	/**
	 * Return the main weapon slot of the player or null if the inventory of the player has not been initialized
	 * @param playerId
	 */
	static async getMainWeaponSlot(playerId: number): Promise<InventorySlot | null> {
		return await InventorySlot.findOne({
			where: {
				playerId,
				slot: 0,
				itemCategory: ItemCategory.WEAPON
			}
		});
	}

	/**
	 * Return the main armor slot of the player or null if the inventory of the player has not been initialized
	 * @param playerId
	 */
	static async getMainArmorSlot(playerId: number): Promise<InventorySlot | null> {
		return await InventorySlot.findOne({
			where: {
				playerId,
				slot: 0,
				itemCategory: ItemCategory.ARMOR
			}
		});
	}

	/**
	 * Return the main potion slot of the player or null if the inventory of the player has not been initialized
	 * @param playerId
	 */
	static async getMainPotionSlot(playerId: number): Promise<InventorySlot | null> {
		return await InventorySlot.findOne({
			where: {
				playerId,
				slot: 0,
				itemCategory: ItemCategory.POTION
			}
		});
	}

	/**
	 * Return the main object slot of the player or null if the inventory of the player has not been initialized
	 * @param playerId
	 */
	static async getMainObjectSlot(playerId: number): Promise<InventorySlot | null> {
		return await InventorySlot.findOne({
			where: {
				playerId,
				slot: 0,
				itemCategory: ItemCategory.OBJECT
			}
		});
	}

	/**
	 * Return the current active items a player hold
	 */
	static async getMainSlotsItems(playerId: number): Promise<PlayerActiveObjects> {
		await this.getOfPlayer(playerId);
		return {
			weapon: <Weapon>(await InventorySlots.getMainWeaponSlot(playerId))!.getItem(),
			armor: <Armor>(await InventorySlots.getMainArmorSlot(playerId))!.getItem(),
			potion: <Potion>(await InventorySlots.getMainPotionSlot(playerId))!.getItem(),
			object: <ObjectItem>(await InventorySlots.getMainObjectSlot(playerId))!.getItem()
		};
	}

	/**
	 * Get the list of all the active objects of the player
	 */
	static async getPlayerActiveObjects(playerId: number): Promise<PlayerActiveObjects> {
		return await this.getMainSlotsItems(playerId);
	}

	/**
	 * Checks if a player have a given item in its inventory
	 * @param playerId
	 * @param itemId
	 * @param category
	 */
	static async hasItem(playerId: number, itemId: number, category: number): Promise<boolean> {
		return await InventorySlot.findOne({
			rejectOnEmpty: false,
			where: {
				playerId,
				itemId,
				itemCategory: category
			}
		}) !== null;
	}

	/**
	 * Count the number of objects of a player that has the given tag
	 * @param playerId
	 * @param tag
	 */
	static async countObjectsOfPlayer(playerId: number, tag: string): Promise<number> {
		const objs = await InventorySlot.findAll({
			where: { playerId }
		});
		let count = 0;
		for (const obj of objs) {
			if (obj.getItem()
				?.tags
				?.includes(tag)) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Switch the 2 given items in the inventory
	 * @param itemToPutInReserve
	 * @param player
	 * @param itemToPutInMain
	 */
	static async switchItemSlots(player: Player, itemToPutInMain: InventorySlot, itemToPutInReserve: InventorySlot): Promise<void> {
		if (itemToPutInReserve.itemId === 0) {
			await InventorySlot.destroy({
				where: {
					playerId: player.id,
					itemCategory: itemToPutInMain.itemCategory,
					slot: itemToPutInMain.slot
				}
			});
		}
		else {
			await InventorySlot.update({
				itemId: itemToPutInReserve.itemId,
				remainingPotionUsages: itemToPutInReserve.remainingPotionUsages
			}, {
				where: {
					playerId: player.id,
					itemCategory: itemToPutInMain.itemCategory,
					slot: itemToPutInMain.slot
				}
			});
		}
		await InventorySlot.update({
			itemId: itemToPutInMain.itemId,
			remainingPotionUsages: itemToPutInMain.remainingPotionUsages
		}, {
			where: {
				playerId: player.id,
				itemCategory: itemToPutInReserve.itemCategory,
				slot: itemToPutInReserve.slot
			}
		});
	}

	static async deposeItem(player: Player, itemToDeposit: DepositCandidate): Promise<void> {
		await InventorySlot.create({
			playerId: player.id,
			itemCategory: itemToDeposit.slot.itemCategory,
			itemId: itemToDeposit.slot.itemId,
			slot: itemToDeposit.freeSlot,
			remainingPotionUsages: itemToDeposit.slot.remainingPotionUsages
		});
		await InventorySlot.update({
			itemId: 0,
			remainingPotionUsages: null
		}, {
			where: {
				playerId: player.id,
				itemCategory: itemToDeposit.slot.itemCategory,
				slot: InventoryConstants.DEFAULT_SLOT_VALUE
			}
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	InventorySlot.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemCategory: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemId: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		remainingPotionUsages: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "inventory_slots",
		freezeTableName: true
	});

	InventorySlot.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default InventorySlot;
