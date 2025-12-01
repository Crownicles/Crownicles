import {
	DataTypes, QueryInterface
} from "sequelize";

/**
 * Add isDistantExpedition column to pet_expeditions table.
 * This stores whether the expedition is a distant expedition (3rd option),
 * which affects the display name and narration in Discord.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("pet_expeditions", "isDistantExpedition", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("pet_expeditions", "isDistantExpedition");
}
