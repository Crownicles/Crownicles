import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Highest king's challenge tier rewarded this week, reset every Monday with the weekly score
	await context.addColumn("players", "kingChallengeTier", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false,
		defaultValue: 0
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "kingChallengeTier");
}
