import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Members already in a guild keep full access to its shelter: only those joining from now on are on probation
	await context.addColumn("players", "guildJoinedAt", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "guildJoinedAt");
}
