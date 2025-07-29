import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsFightsResults extends Model {
	declare readonly id: number;

	declare readonly fightInitiatorId: number;

	declare readonly fightInitiatorPoints: number;

	declare readonly player2Id: number;

	declare readonly player2Points: number;

	declare readonly turn: number;

	declare readonly winner: number;

	declare readonly friendly: boolean;

	declare readonly fightInitiatorInitialDefenseGlory?: number;

	declare readonly fightInitiatorInitialAttackGlory?: number;

	declare readonly fightInitiatorClassId?: number;

	declare readonly player2InitialDefenseGlory?: number;

	declare readonly player2InitialAttackGlory?: number;

	declare readonly player2ClassId?: number;

	declare readonly fightInitiatorPetId?: number;

	declare readonly player2PetId?: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsFightsResults.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		fightInitiatorId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		fightInitiatorPoints: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		player2Id: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		player2Points: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		turn: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		winner: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		friendly: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		fightInitiatorInitialDefenseGlory: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		fightInitiatorInitialAttackGlory: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		fightInitiatorClassId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		player2InitialDefenseGlory: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		player2InitialAttackGlory: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		player2ClassId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		fightInitiatorPetId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		player2PetId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "fights_results",
		freezeTableName: true,
		timestamps: false
	});
}
