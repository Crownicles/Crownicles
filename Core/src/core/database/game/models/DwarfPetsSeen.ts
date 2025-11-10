import {
	DataTypes, Model, Sequelize
} from "sequelize";
import Player from "./Player";
import { PetDataController } from "../../../../data/Pet";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";

export class DwarfPetsSeen extends Model {
	declare readonly playerId: number;

	declare readonly petTypeId: number;

	/**
	 * Return true if the player has already shown this pet
	 * @param player
	 * @param petTypeId
	 */
	static async isPetSeen(player: Player, petTypeId: number): Promise<boolean> {
		const count = await DwarfPetsSeen.count({
			where: {
				playerId: player.id,
				petTypeId
			}
		});
		return count > 0;
	}

	/**
	 * Save that the player shows to the dwarf the pet
	 * @param player
	 * @param petTypeId
	 */
	static async markPetAsSeen(player: Player, petTypeId: number): Promise<void> {
		await DwarfPetsSeen.create({
			playerId: player.id,
			petTypeId
		});
	}

	/**
	 * Return true if the player has shown every pet
	 * @param player
	 */
	static async isAllPetSeen(player: Player): Promise<boolean> {
		const petsSeen = await DwarfPetsSeen.count({
			where: { playerId: player.id }
		});

		return petsSeen === PetDataController.instance.getPetsCount();
	}

	/**
	 * Return an array of pet ID that the player has showed to the dwarf
	 * @param player
	 */
	static async getPetsSeenId(player: Player): Promise<number[]> {
		const petsSeen = await DwarfPetsSeen.findAll({
			where: { playerId: player.id }
		});
		return petsSeen.map(pet => pet.petTypeId);
	}

	static async getPetsNotSeenId(player: Player): Promise<number[]> {
		const petsSeenId = await DwarfPetsSeen.getPetsSeenId(player);
		const petsNotSeenIds: number[] = [];
		for (let i = 1; i < PetDataController.instance.getPetsCount(); i++) {
			if (!petsSeenId.includes(i)) {
				petsNotSeenIds.push(i);
			}
		}
		return petsNotSeenIds;
	}

	static async getRandomPetNotSeenId(player: Player): Promise<number> {
		const petsNotSeenIds = await DwarfPetsSeen.getPetsNotSeenId(player);
		return petsNotSeenIds.length > 0 ? RandomUtils.crowniclesRandom.pick(petsNotSeenIds) : 0;
	}

	static async getNumberOfPetsNotSeen(player: Player): Promise<number> {
		const petsNotSeenIds = await DwarfPetsSeen.getPetsNotSeenId(player);
		return petsNotSeenIds.length;
	}
}


export function initModel(sequelize: Sequelize): void {
	DwarfPetsSeen.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		petTypeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		}
	}, {
		sequelize,
		tableName: "dwarf_pets_seen",
		freezeTableName: true,
		timestamps: false
	});
}
