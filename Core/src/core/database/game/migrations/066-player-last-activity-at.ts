import {
	DataTypes, QueryInterface, Sequelize
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "lastActivityAt", {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
	});
	await context.sequelize.query(`
		UPDATE players
		SET lastActivityAt = CASE
			WHEN insideCity = 1 THEN updatedAt
			ELSE startTravelDate
		END
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "lastActivityAt");
}
