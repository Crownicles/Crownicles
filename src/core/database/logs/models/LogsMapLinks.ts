import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsMapLinks extends Model {
	declare readonly id: number;

	declare readonly start: number;

	declare readonly end: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsMapLinks.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		start: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		end: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "map_links",
		freezeTableName: true,
		timestamps: false
	});
}