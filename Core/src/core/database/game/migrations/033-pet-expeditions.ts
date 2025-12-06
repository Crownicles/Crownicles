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
		mapLocationId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1
		},
		rewardIndex: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		isDistantExpedition: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		status: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false,
			defaultValue: EXPEDITION_STATUS_IN_PROGRESS
		},
		foodConsumed: {
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

	// Create scheduled_expedition_notifications table
	await context.createTable("scheduled_expedition_notifications", {
		expeditionId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petSex: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(1),
			allowNull: false
		},
		petNickname: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: true
		},
		scheduledAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
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

	// Remove columns from players
	await context.removeColumn("players", "hasCloneTalisman");
	await context.removeColumn("players", "hasTalisman");

	// Drop tables
	await context.dropTable("scheduled_expedition_notifications");
	await context.dropTable("pet_expeditions");
}
