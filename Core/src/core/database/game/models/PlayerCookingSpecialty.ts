import {
	DataTypes, Model, Sequelize
} from "sequelize";
import type { CookingRecipeId } from "../../../../../../Lib/src/types/CookingRecipe";

/**
 * A recipe a master chef made one of their specialties: it is offered on the furnace station
 * `slotIndex` at every ignition, until the chef removes it
 */
export class PlayerCookingSpecialty extends Model {
	declare readonly playerId: number;

	declare readonly slotIndex: number;

	declare readonly recipeId: CookingRecipeId;

	static getOfPlayer(playerId: number): Promise<PlayerCookingSpecialty[]> {
		return PlayerCookingSpecialty.findAll({
			where: { playerId },
			order: [["slotIndex", "ASC"]]
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerCookingSpecialty.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		slotIndex: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false,
			primaryKey: true
		},
		recipeId: {
			type: DataTypes.STRING(64), // eslint-disable-line new-cap
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "player_cooking_specialties",
		freezeTableName: true,
		timestamps: false
	});
}

export default PlayerCookingSpecialty;
