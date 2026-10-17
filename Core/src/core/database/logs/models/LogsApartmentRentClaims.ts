/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsApartmentRentClaims extends Model {
	declare readonly playerId: number;

	declare readonly apartmentId: number;

	declare readonly cityId: string;

	declare readonly rentClaimed: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsApartmentRentClaims.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		apartmentId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		rentClaimed: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "apartment_rent_claims",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
