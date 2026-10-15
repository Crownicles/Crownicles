import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("player_badges", "revealedInApp", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});

	// Badges owned before the app could celebrate them are not announced as new.
	await context.sequelize.query("UPDATE player_badges SET revealedInApp = TRUE");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_badges", "revealedInApp");
}
