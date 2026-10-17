import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsPetsFrees extends Model {
	declare readonly playerId: number | null;

	declare readonly petId: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPetsFrees.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "pets_frees",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
