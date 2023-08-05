import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsPossibilities extends Model {
	declare readonly id: number;

	declare readonly bigEventId: number;

	declare readonly emote: string;

	declare readonly issueIndex: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPossibilities.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		bigEventId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		emote: {
			type: DataTypes.STRING(5), // eslint-disable-line new-cap
			allowNull: true // null for end
		},
		issueIndex: {
			type: DataTypes.INTEGER,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "possibilities",
		freezeTableName: true,
		timestamps: false
	});
}