import {
	DataTypes, Model, Sequelize
} from "sequelize";
import Player from "./Player";

export class PlayerCookingRecipe extends Model {
	declare readonly playerId: number;

	declare readonly recipeId: string;

	static async isRecipeDiscovered(player: Player, recipeId: string): Promise<boolean> {
		const count = await PlayerCookingRecipe.count({
			where: {
				playerId: player.id,
				recipeId
			}
		});
		return count > 0;
	}

	static async discoverRecipe(player: Player, recipeId: string): Promise<void> {
		await PlayerCookingRecipe.findOrCreate({
			where: {
				playerId: player.id,
				recipeId
			}
		});
	}

	static async getDiscoveredRecipeIds(player: Player): Promise<string[]> {
		const recipes = await PlayerCookingRecipe.findAll({
			where: { playerId: player.id }
		});
		return recipes.map(r => r.recipeId);
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerCookingRecipe.init({
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
		tableName: "player_cooking_recipes",
		freezeTableName: true,
		timestamps: false
	});
}

export default PlayerCookingRecipe;
