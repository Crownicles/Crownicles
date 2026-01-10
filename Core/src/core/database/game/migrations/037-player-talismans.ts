import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Create player_talismans table
	await context.createTable("player_talismans", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		hasTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false
		},
		hasCloneTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
	});

	// Migrate data from players table to player_talismans
	await context.sequelize.query(`
		INSERT INTO player_talismans (playerId, hasTalisman, hasCloneTalisman, updatedAt, createdAt)
		SELECT id, hasTalisman, hasCloneTalisman, NOW(), NOW()
		FROM players
		WHERE hasTalisman = TRUE OR hasCloneTalisman = TRUE
	`);

	// Remove columns from players table
	await context.removeColumn("players", "hasTalisman");
	await context.removeColumn("players", "hasCloneTalisman");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Add columns back to players table
	await context.addColumn("players", "hasTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
	await context.addColumn("players", "hasCloneTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});

	// Migrate data back from player_talismans to players
	await context.sequelize.query(`
		UPDATE players p
		INNER JOIN player_talismans pt ON p.id = pt.playerId
		SET p.hasTalisman = pt.hasTalisman, p.hasCloneTalisman = pt.hasCloneTalisman
	`);

	// Drop player_talismans table
	await context.dropTable("player_talismans");
}
