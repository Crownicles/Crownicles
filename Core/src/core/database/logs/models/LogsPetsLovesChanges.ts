import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsPetsLovesChanges extends Model {
	declare readonly playerId: number | null;

	declare readonly petId: number;

	declare readonly lovePoints: number;

	declare readonly reason: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPetsLovesChanges.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		lovePoints: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		reason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "pets_loves_changes",
		freezeTableName: true,
		timestamps: false
	});

	LogsPetsLovesChanges.removeAttribute("id");
}
