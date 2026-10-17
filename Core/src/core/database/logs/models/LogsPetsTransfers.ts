import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsPetsTransfers extends Model {
	declare readonly playerId: number | null;

	declare readonly playerPetId: number;

	declare readonly guildPetId: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPetsTransfers.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		playerPetId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		guildPetId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "pets_transfers",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
