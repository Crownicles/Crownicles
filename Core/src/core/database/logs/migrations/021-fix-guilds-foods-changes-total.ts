import {
	DataTypes, QueryInterface
} from "sequelize";

/**
 * Widens `guilds_foods_changes.total` from TINYINT UNSIGNED (max 255) to
 * MEDIUMINT UNSIGNED (max 16_777_215). A guild's accumulated food storage
 * can largely exceed 255, which made the original column overflow and crash
 * the insert at runtime.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("guilds_foods_changes", "total", {
		type: DataTypes.MEDIUMINT.UNSIGNED,
		allowNull: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("guilds_foods_changes", "total", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false
	});
}
