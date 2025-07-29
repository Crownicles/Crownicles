import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("fights_results", "fightInitiatorPetId", {
		type: DataTypes.INTEGER,
		allowNull: true
	});
	await context.addColumn("fights_results", "player2PetId", {
		type: DataTypes.INTEGER,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("fights_results", "fightInitiatorPetId");
	await context.removeColumn("fights_results", "player2PetId");
}