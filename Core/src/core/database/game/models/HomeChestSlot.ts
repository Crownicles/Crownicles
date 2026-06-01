import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import { GenericItem } from "../../../../data/GenericItem";
import { ArmorDataController } from "../../../../data/Armor";
import { WeaponDataController } from "../../../../data/Weapon";
import { PotionDataController } from "../../../../data/Potion";
import { ObjectItemDataController } from "../../../../data/ObjectItem";
import Player from "./Player";
import { ItemWithDetails } from "../../../../../../Lib/src/types/ItemWithDetails";
import { toItemWithDetails } from "../../../utils/ItemUtils";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { ChestSlotsPerCategory } from "../../../../../../Lib/src/types/HomeFeatures";

export class HomeChestSlot extends Model {
	declare readonly homeId: number;

	declare slot: number;

	declare itemCategory: number;

	declare itemId: number;

	declare itemLevel: number;

	declare itemEnchantmentId: string | null;

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

	isEmpty(): boolean {
		return this.itemId === 0;
	}

	itemWithDetails(player: Player): ItemWithDetails {
		return toItemWithDetails(player, this.getItem()!, this.itemLevel, this.itemEnchantmentId);
	}
}

export class HomeChestSlots {
	/**
	 * Get all chest slots for a home
	 */
	public static async getOfHome(homeId: number): Promise<HomeChestSlot[]> {
		return await HomeChestSlot.findAll({
			where: { homeId }
		});
	}

	/**
	 * Get chest slots for a home filtered by category
	 */
	public static async getOfHomeByCategory(homeId: number, category: ItemCategory): Promise<HomeChestSlot[]> {
		return await HomeChestSlot.findAll({
			where: {
				homeId,
				itemCategory: category
			}
		});
	}

	/**
	 * Get a specific chest slot
	 */
	public static async getSlot(homeId: number, slot: number, category: ItemCategory): Promise<HomeChestSlot | null> {
		return await HomeChestSlot.findOne({
			where: {
				homeId,
				slot,
				itemCategory: category
			}
		});
	}

	/**
	 * Initialize empty chest slots for a home based on the slots per category
	 */
	public static async initializeSlots(homeId: number, slotsPerCategory: ChestSlotsPerCategory): Promise<void> {
		const slotsToCreate: {
			homeId: number;
			slot: number;
			itemCategory: number;
			itemId: number;
			itemLevel: number;
			itemEnchantmentId: null;
		}[] = [];

		const categoryMap: {
			key: keyof ChestSlotsPerCategory; category: ItemCategory;
		}[] = [
			{
				key: "weapon", category: ItemCategory.WEAPON
			},
			{
				key: "armor", category: ItemCategory.ARMOR
			},
			{
				key: "potion", category: ItemCategory.POTION
			},
			{
				key: "object", category: ItemCategory.OBJECT
			}
		];

		for (const {
			key, category
		} of categoryMap) {
			for (let slot = 1; slot <= slotsPerCategory[key]; slot++) {
				slotsToCreate.push({
					homeId,
					slot,
					itemCategory: category,
					itemId: 0,
					itemLevel: 0,
					itemEnchantmentId: null
				});
			}
		}

		if (slotsToCreate.length > 0) {
			await HomeChestSlot.bulkCreate(slotsToCreate, { ignoreDuplicates: true });
		}
	}

	/**
	 * Ensure chest slots match the current home level (add new empty slots if home was upgraded)
	 */
	public static async ensureSlotsForLevel(homeId: number, slotsPerCategory: ChestSlotsPerCategory): Promise<void> {
		await HomeChestSlots.initializeSlots(homeId, slotsPerCategory);
	}

	/**
	 * Find the first empty slot for a category in the chest
	 */
	public static async findEmptySlot(homeId: number, category: ItemCategory): Promise<HomeChestSlot | null> {
		return await HomeChestSlot.findOne({
			where: {
				homeId,
				itemCategory: category,
				itemId: 0
			}
		});
	}

	/**
	 * Get all non-empty slots for a category in the chest
	 */
	public static async getFilledSlots(homeId: number, category: ItemCategory): Promise<HomeChestSlot[]> {
		const slots = await HomeChestSlot.findAll({
			where: {
				homeId,
				itemCategory: category
			}
		});
		return slots.filter(s => s.itemId !== 0);
	}

	/**
	 * Delete all chest slots for a home (used when a home is deleted)
	 */
	public static async deleteOfHome(homeId: number): Promise<void> {
		await HomeChestSlot.destroy({
			where: { homeId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	HomeChestSlot.init({
		homeId: {
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
		itemLevel: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		itemEnchantmentId: {
			type: DataTypes.STRING,
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
		tableName: "home_chest_slots",
		freezeTableName: true
	});

	HomeChestSlot.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default HomeChestSlot;
