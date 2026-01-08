import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add lastExpeditionEndDate column to pet_entities table
	// This column tracks when a pet's last expedition ended, used to determine fatigue
	await context.addColumn("pet_entities", "lastExpeditionEndDate", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("pet_entities", "lastExpeditionEndDate");
}
