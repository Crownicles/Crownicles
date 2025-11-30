/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsExpeditions extends Model {
	declare readonly playerId: number;

	declare readonly petId: number;

	declare readonly mapLocationId: number;

	declare readonly locationType: string;

	declare readonly action: string;

	declare readonly durationMinutes: number;

	declare readonly rewardIndex: number;

	declare readonly foodConsumed: number;

	declare readonly success: boolean | null;

	declare readonly money: number | null;

	declare readonly experience: number | null;

	declare readonly points: number | null;

	declare readonly cloneTalismanFound: boolean | null;

	declare readonly loveChange: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsExpeditions.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		mapLocationId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		locationType: {
			type: DataTypes.STRING(20),
			allowNull: false
		},
		action: {
			type: DataTypes.STRING(10),
			allowNull: false
		},
		durationMinutes: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		rewardIndex: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		foodConsumed: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		success: {
			type: DataTypes.BOOLEAN,
			allowNull: true
		},
		money: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		experience: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		points: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		cloneTalismanFound: {
			type: DataTypes.BOOLEAN,
			allowNull: true
		},
		loveChange: {
			type: DataTypes.SMALLINT,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "expeditions",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
