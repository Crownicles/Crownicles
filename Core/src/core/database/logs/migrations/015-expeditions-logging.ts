/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("expeditions", {
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
	});

	// Add index on playerId for fast count queries
	await context.addIndex("expeditions", ["playerId"]);

	// Add index on action for filtering by action type
	await context.addIndex("expeditions", ["action"]);

	// Composite index for counting successful expeditions
	await context.addIndex("expeditions", [
		"playerId",
		"action",
		"success"
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("expeditions");
}
