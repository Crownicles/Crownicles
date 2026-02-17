import {
	DataTypes, QueryInterface
} from "sequelize";
import * as moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	const now = moment()
		.format("YYYY-MM-DD HH:mm:ss");

	// Create home_garden_slots: tracks what's planted in each garden plot
	await context.createTable("home_garden_slots", {
		homeId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		plantId: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		plantedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: null
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: now
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: now
		}
	});

	// Create home_plant_storage: stores harvested plants per house (quantity per plant type)
	await context.createTable("home_plant_storage", {
		homeId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		plantId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		quantity: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: now
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: now
		}
	});

	// Create player_plant_slots: player carried plant inventory (seeds + plants)
	await context.createTable("player_plant_slots", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		slotType: {
			type: DataTypes.STRING(5), // eslint-disable-line new-cap
			primaryKey: true
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		plantId: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: now
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: now
		}
	});

	// Add plantSlots column to inventory_info
	await context.addColumn("inventory_info", "plantSlots", {
		type: DataTypes.INTEGER,
		defaultValue: 1
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("home_garden_slots");
	await context.dropTable("home_plant_storage");
	await context.dropTable("player_plant_slots");
	await context.removeColumn("inventory_info", "plantSlots");
}
