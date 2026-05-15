import {
	DataTypes, QueryInterface
} from "sequelize";
import * as moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("apartments", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		ownerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		purchasePrice: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		lastRentClaimedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	});

	await context.addIndex("apartments", ["ownerId", "cityId"], {
		unique: true,
		name: "apartments_owner_city_unique"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("apartments");
}
