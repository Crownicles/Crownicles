import {
	DataTypes, QueryInterface
} from "sequelize";

const EXPEDITION_STATUS_IN_PROGRESS = "in_progress";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Create pet_expeditions table
	await context.createTable("pet_expeditions", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		startDate: {
			type: DataTypes.DATE,
			allowNull: false
		},
		endDate: {
			type: DataTypes.DATE,
			allowNull: false
		},
		riskRate: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		difficulty: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		wealthRate: {
			type: DataTypes.FLOAT,
			allowNull: false
		},
		locationType: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		status: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false,
			defaultValue: EXPEDITION_STATUS_IN_PROGRESS
		},
		foodConsumed: {
			// Amount of food consumed when the expedition departed
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	// Add hasTalisman column to players table
	await context.addColumn("players", "hasTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});

	// Add hasCloneTalisman column to players table
	await context.addColumn("players", "hasCloneTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});

	// Add indexes for better query performance
	await context.addIndex("pet_expeditions", ["playerId"], { name: "pet_expeditions_player_id" });
	await context.addIndex("pet_expeditions", ["status"], { name: "pet_expeditions_status" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Remove indexes
	await context.removeIndex("pet_expeditions", "pet_expeditions_player_id");
	await context.removeIndex("pet_expeditions", "pet_expeditions_status");

	// Remove hasCloneTalisman column from players
	await context.removeColumn("players", "hasCloneTalisman");

	// Remove hasTalisman column from players
	await context.removeColumn("players", "hasTalisman");

	// Drop pet_expeditions table
	await context.dropTable("pet_expeditions");
}
