import {
	DataTypes, QueryInterface
} from "sequelize";

const PET_LOG_TABLES = [
	"pet_nicknames",
	"pets_frees",
	"pets_loves_changes",
	"pets_transfers"
] as const;

function playerIndexName(tableName: typeof PET_LOG_TABLES[number]): string {
	return `idx_${tableName}_player`;
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	for (const tableName of PET_LOG_TABLES) {
		await context.addColumn(tableName, "playerId", {
			type: DataTypes.INTEGER,
			allowNull: true
		});
		await context.addIndex(tableName, ["playerId"], { name: playerIndexName(tableName) });
	}
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	for (const tableName of [...PET_LOG_TABLES].reverse()) {
		await context.removeIndex(tableName, playerIndexName(tableName));
		await context.removeColumn(tableName, "playerId");
	}
}
