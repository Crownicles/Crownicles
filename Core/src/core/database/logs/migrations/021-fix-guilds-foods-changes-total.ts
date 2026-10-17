import {
	DataTypes, QueryInterface
} from "sequelize";

/**
 * Widens `guilds_foods_changes.total` from TINYINT UNSIGNED (max 255) to
 * SMALLINT UNSIGNED (max 65_535). A guild's food storage snapshot can
 * exceed 255 (current max pantry cap is 1000 for common food), which made
 * the original column overflow and crash the insert at runtime.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("guilds_foods_changes", "total", {
		type: DataTypes.SMALLINT.UNSIGNED,
		allowNull: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("guilds_foods_changes", "total", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false
	});
}
