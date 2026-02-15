import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { PlantConstants } from "../../../../../../Lib/src/constants/PlantConstants";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class HomePlantStorage extends Model {
	declare readonly homeId: number;

	declare plantId: number;

	declare quantity: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class HomePlantStorages {
	/**
	 * Get all plant storage entries for a home
	 */
	public static async getOfHome(homeId: number): Promise<HomePlantStorage[]> {
		return await HomePlantStorage.findAll({
			where: { homeId },
			order: [["plantId", "ASC"]]
		});
	}

	/**
	 * Get storage for a specific plant type
	 */
	public static async getForPlant(homeId: number, plantId: number): Promise<HomePlantStorage | null> {
		return await HomePlantStorage.findOne({
			where: {
				homeId, plantId
			}
		});
	}

	/**
	 * Initialize storage entries for all plant types
	 */
	public static async initializeStorage(homeId: number): Promise<void> {
		const entriesToCreate: {
			homeId: number;
			plantId: number;
			quantity: number;
		}[] = [];

		for (let plantId = 1; plantId <= PlantConstants.PLANT_COUNT; plantId++) {
			entriesToCreate.push({
				homeId,
				plantId,
				quantity: 0
			});
		}

		await HomePlantStorage.bulkCreate(entriesToCreate, { ignoreDuplicates: true });
	}

	/**
	 * Add plants to storage, capped at max capacity. Returns the number of plants that didn't fit.
	 */
	public static async addPlant(homeId: number, plantId: number, amount: number, maxCapacity: number): Promise<number> {
		let storage = await HomePlantStorages.getForPlant(homeId, plantId);

		if (!storage) {
			await HomePlantStorages.initializeStorage(homeId);
			storage = await HomePlantStorages.getForPlant(homeId, plantId);
		}

		if (!storage) {
			return amount;
		}

		const spaceAvailable = maxCapacity - storage.quantity;
		const toAdd = Math.min(amount, spaceAvailable);
		const overflow = amount - toAdd;

		if (toAdd > 0) {
			storage.quantity += toAdd;
			await storage.save();
		}

		return overflow;
	}

	/**
	 * Remove a plant from storage. Returns true if successful.
	 */
	public static async removePlant(homeId: number, plantId: number): Promise<boolean> {
		const storage = await HomePlantStorages.getForPlant(homeId, plantId);

		if (!storage || storage.quantity <= 0) {
			return false;
		}

		storage.quantity -= 1;
		await storage.save();
		return true;
	}

	/**
	 * Delete all plant storage for a home
	 */
	public static async deleteOfHome(homeId: number): Promise<void> {
		await HomePlantStorage.destroy({
			where: { homeId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	HomePlantStorage.init({
		homeId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		plantId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		quantity: {
			type: DataTypes.INTEGER,
			defaultValue: 0
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
		tableName: "home_plant_storage",
		freezeTableName: true
	});

	HomePlantStorage.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default HomePlantStorage;
