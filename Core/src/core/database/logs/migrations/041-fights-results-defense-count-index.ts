import { QueryInterface } from "sequelize";

const INDEX_NAME = "idx_player2_friendly_date";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Counts the ranked defenses of a player for the defender K-factor (#5140), like
	 * idx_fightInitiator_friendly_date does for the attacks:
	 * SELECT COUNT(*) FROM fights_results WHERE player2Id = ? AND friendly = false AND date >= ?
	 */
	await context.addIndex("fights_results", [
		"player2Id",
		"friendly",
		"date"
	], { name: INDEX_NAME });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("fights_results", INDEX_NAME);
}
