import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add hasCloneTalisman column to players table
	await context.addColumn("players", "hasCloneTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Remove hasCloneTalisman column from players
	await context.removeColumn("players", "hasCloneTalisman");
}
