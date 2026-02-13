import {
	DataTypes, QueryInterface
} from "sequelize";
import * as moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("home_chest_slots", {
		homeId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemCategory: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemId: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		itemLevel: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		itemEnchantmentId: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null
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
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("home_chest_slots");
}
