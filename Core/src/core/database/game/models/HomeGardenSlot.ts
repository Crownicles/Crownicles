import {
	DataTypes, Model, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { PlantId } from "../../../../../../Lib/src/constants/PlantConstants";

export class HomeGardenSlot extends Model {
	declare readonly homeId: number;

	declare slot: number;

	declare plantId: PlantId | 0;

	declare plantedAt: Date | null;

	declare updatedAt: Date;

	declare createdAt: Date;

	isEmpty(): boolean {
		return this.plantId === 0;
	}

	/**
	 * Check if the plant in this slot is ready to harvest
	 */
	isReady(effectiveGrowthTimeSeconds: number): boolean {
		if (this.isEmpty() || !this.plantedAt) {
			return false;
		}
		const now = Date.now();
		const plantedTime = this.plantedAt.valueOf();
		return now - plantedTime >= effectiveGrowthTimeSeconds * 1000;
	}

	/**
	 * Get growth progress as a ratio (0 to 1)
	 */
	getGrowthProgress(effectiveGrowthTimeSeconds: number): number {
		if (this.isEmpty() || !this.plantedAt) {
			return 0;
		}
		const elapsed = Date.now() - this.plantedAt.valueOf();
		return Math.min(1, elapsed / (effectiveGrowthTimeSeconds * 1000));
	}
}

export class HomeGardenSlots {
	/**
	 * Get all garden slots for a home
	 */
	public static async getOfHome(homeId: number): Promise<HomeGardenSlot[]> {
		return await HomeGardenSlot.findAll({
			where: { homeId },
			order: [["slot", "ASC"]]
		});
	}

	/**
	 * Get a specific garden slot
	 */
	public static async getSlot(homeId: number, slot: number): Promise<HomeGardenSlot | null> {
		return await HomeGardenSlot.findOne({
			where: {
				homeId, slot
			}
		});
	}

	/**
	 * Initialize empty garden slots for a home based on the number of plots
	 */
	public static async initializeSlots(homeId: number, gardenPlots: number): Promise<void> {
		const slotsToCreate: {
			homeId: number;
			slot: number;
			plantId: number;
			plantedAt: null;
		}[] = [];

		for (let slot = 0; slot < gardenPlots; slot++) {
			slotsToCreate.push({
				homeId,
				slot,
				plantId: 0,
				plantedAt: null
			});
		}

		if (slotsToCreate.length > 0) {
			await HomeGardenSlot.bulkCreate(slotsToCreate, { ignoreDuplicates: true });
		}
	}

	/**
	 * Ensure garden slots match the current home level
	 */
	public static async ensureSlotsForLevel(homeId: number, gardenPlots: number): Promise<void> {
		await HomeGardenSlots.initializeSlots(homeId, gardenPlots);
	}

	/**
	 * Find the first empty garden slot
	 */
	public static async findEmptySlot(homeId: number): Promise<HomeGardenSlot | null> {
		return await HomeGardenSlot.findOne({
			where: {
				homeId,
				plantId: 0
			}
		});
	}

	/**
	 * Plant a seed in a specific slot
	 */
	public static async plantSeed(homeId: number, slot: number, plantId: number): Promise<void> {
		const where = {
			homeId, slot
		};
		await HomeGardenSlot.update(
			{
				plantId,
				plantedAt: moment().toDate()
			},
			{ where }
		);
	}

	/**
	 * Reset the growth timer of a slot (after harvest, plant regrows)
	 */
	public static async resetGrowthTimer(homeId: number, slot: number): Promise<void> {
		const where = {
			homeId, slot
		};
		await HomeGardenSlot.update(
			{ plantedAt: moment().toDate() },
			{ where }
		);
	}

	/**
	 * Delete all garden slots for a home
	 */
	public static async deleteOfHome(homeId: number): Promise<void> {
		await HomeGardenSlot.destroy({
			where: { homeId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	HomeGardenSlot.init({
		homeId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		plantId: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		plantedAt: {
			type: DataTypes.DATE,
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
		tableName: "home_garden_slots",
		freezeTableName: true
	});

	HomeGardenSlot.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default HomeGardenSlot;
