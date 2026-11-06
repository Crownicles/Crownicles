import {
	DataTypes, Model, Sequelize
} from "sequelize";
import type { CookingRecipeId } from "../../../../../../Lib/src/types/CookingRecipe";

/**
 * A recipe a master chef made one of their specialties: it is offered on the specialty station
 * at every furnace ignition, until the chef removes it
 */
export class PlayerCookingSpecialty extends Model {
	declare readonly playerId: number;

	declare readonly recipeId: CookingRecipeId;

	static getOfPlayer(playerId: number): Promise<PlayerCookingSpecialty[]> {
		return PlayerCookingSpecialty.findAll({ where: { playerId } });
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerCookingSpecialty.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		recipeId: {
			type: DataTypes.STRING(64), // eslint-disable-line new-cap
			allowNull: false,
			primaryKey: true
		}
	}, {
		sequelize,
		tableName: "player_cooking_specialties",
		freezeTableName: true,
		timestamps: false
	});
}

export default PlayerCookingSpecialty;
