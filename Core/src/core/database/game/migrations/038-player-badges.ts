import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Create player_badges table
	await context.createTable("player_badges", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		badge: {
			type: DataTypes.STRING(32), // eslint-disable-line new-cap
			primaryKey: true
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
	});

	// Migrate data from players table to player_badges. The badges column contains comma-separated values like "badge1,badge2,badge3"

	await context.sequelize.query(`
		INSERT IGNORE INTO player_badges (playerId, badge, updatedAt, createdAt)
		SELECT 
			p.id AS playerId,
			TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.badges, ',', numbers.n), ',', -1)) AS badge,
			NOW() AS updatedAt,
			NOW() AS createdAt
		FROM players p
		INNER JOIN (
			SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
			UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
			UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
			UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
			UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
			UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
		) numbers
		ON CHAR_LENGTH(p.badges) - CHAR_LENGTH(REPLACE(p.badges, ',', '')) >= numbers.n - 1
		WHERE p.badges IS NOT NULL AND p.badges != ''
	`);

	// Remove badges column from players table
	await context.removeColumn("players", "badges");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Add badges column back to players table
	await context.addColumn("players", "badges", {
		type: DataTypes.TEXT,
		allowNull: true,
		defaultValue: null
	});

	// Migrate data back from player_badges to players
	await context.sequelize.query(`
		UPDATE players p
		SET p.badges = (
			SELECT GROUP_CONCAT(pb.badge ORDER BY pb.createdAt SEPARATOR ',')
			FROM player_badges pb
			WHERE pb.playerId = p.id
			GROUP BY pb.playerId
		)
	`);

	// Drop player_badges table
	await context.dropTable("player_badges");
}
