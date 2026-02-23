import {
	DataTypes, Model, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import {
	PlantId, PLANT_SLOT_TYPE, PlantSlotType
} from "../../../../../../Lib/src/constants/PlantConstants";

export class PlayerPlantSlot extends Model {
	declare readonly playerId: number;

	declare slotType: PlantSlotType;

	declare slot: number;

	declare plantId: PlantId | 0;

	declare updatedAt: Date;

	declare createdAt: Date;

	isEmpty(): boolean {
		return this.plantId === 0;
	}
}

export class PlayerPlantSlots {
	/**
	 * Get all plant slots for a player
	 */
	public static async getOfPlayer(playerId: number): Promise<PlayerPlantSlot[]> {
		return await PlayerPlantSlot.findAll({
			where: { playerId },
			order: [
				["slotType", "ASC"],
				["slot", "ASC"]
			]
		});
	}

	/**
	 * Get the player's seed slot
	 */
	public static async getSeedSlot(playerId: number): Promise<PlayerPlantSlot | null> {
		return await PlayerPlantSlot.findOne({
			where: {
				playerId,
				slotType: PLANT_SLOT_TYPE.SEED,
				slot: 0
			}
		});
	}

	/**
	 * Get all plant-type slots for a player
	 */
	public static async getPlantSlots(playerId: number): Promise<PlayerPlantSlot[]> {
		return await PlayerPlantSlot.findAll({
			where: {
				playerId,
				slotType: PLANT_SLOT_TYPE.PLANT
			},
			order: [["slot", "ASC"]]
		});
	}

	/**
	 * Initialize default slots for a player (1 seed slot + initial plant slots)
	 */
	public static async initializeSlots(playerId: number, plantSlotCount: number): Promise<void> {
		const slotsToCreate: {
			playerId: number;
			slotType: PlantSlotType;
			slot: number;
			plantId: number;
		}[] = [];

		// Seed slot (always 1)
		slotsToCreate.push({
			playerId,
			slotType: PLANT_SLOT_TYPE.SEED,
			slot: 0,
			plantId: 0
		});

		// Plant slots
		for (let slot = 0; slot < plantSlotCount; slot++) {
			slotsToCreate.push({
				playerId,
				slotType: PLANT_SLOT_TYPE.PLANT,
				slot,
				plantId: 0
			});
		}

		await PlayerPlantSlot.bulkCreate(slotsToCreate, { ignoreDuplicates: true });
	}

	/**
	 * Ensure plant slots match the current count (for tanner upgrades)
	 */
	public static async ensureSlotsForCount(playerId: number, plantSlotCount: number): Promise<void> {
		await PlayerPlantSlots.initializeSlots(playerId, plantSlotCount);
	}

	/**
	 * Find the first empty plant slot
	 */
	public static async findEmptyPlantSlot(playerId: number): Promise<PlayerPlantSlot | null> {
		return await PlayerPlantSlot.findOne({
			where: {
				playerId,
				slotType: PLANT_SLOT_TYPE.PLANT,
				plantId: 0
			}
		});
	}

	/**
	 * Set a seed in the player's seed slot
	 */
	public static async setSeed(playerId: number, plantId: number): Promise<void> {
		await PlayerPlantSlot.update(
			{ plantId },
			{
				where: {
					playerId,
					slotType: PLANT_SLOT_TYPE.SEED,
					slot: 0
				}
			}
		);
	}

	/**
	 * Clear the player's seed slot
	 */
	public static async clearSeed(playerId: number): Promise<void> {
		await PlayerPlantSlots.setSeed(playerId, 0);
	}

	/**
	 * Place a plant in a specific slot
	 */
	public static async setPlant(playerId: number, slot: number, plantId: number): Promise<void> {
		await PlayerPlantSlot.update(
			{ plantId },
			{
				where: {
					playerId,
					slotType: PLANT_SLOT_TYPE.PLANT,
					slot
				}
			}
		);
	}

	/**
	 * Clear a specific plant slot
	 */
	public static async clearPlant(playerId: number, slot: number): Promise<void> {
		await PlayerPlantSlots.setPlant(playerId, slot, 0);
	}

	/**
	 * Check if the player already has a seed of a given plant type
	 */
	public static async hasSeedOfType(playerId: number, plantId: number): Promise<boolean> {
		const seedSlot = await PlayerPlantSlots.getSeedSlot(playerId);
		return seedSlot?.plantId === plantId;
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerPlantSlot.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		slotType: {
			type: DataTypes.STRING(5), // eslint-disable-line new-cap
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
		tableName: "player_plant_slots",
		freezeTableName: true
	});

	PlayerPlantSlot.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerPlantSlot;
