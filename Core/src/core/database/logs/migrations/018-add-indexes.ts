import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// players_commands - most queried table (139 MB, 2.9M rows)
	await context.addIndex("players_commands", ["date"], { name: "idx_date" });
	await context.addIndex("players_commands", ["playerId", "date"], { name: "idx_player_date" });

	// players_money (67 MB, 1.7M rows)
	await context.addIndex("players_money", ["playerId", "date"], { name: "idx_player_date" });

	// players_small_events (57 MB, 1.6M rows)
	await context.addIndex("players_small_events", ["playerId", "date"], { name: "idx_player_date" });
	await context.addIndex("players_small_events", ["smallEventId", "date"], { name: "idx_smallevent_date" });

	// players_score (37 MB, 970K rows)
	await context.addIndex("players_score", ["playerId", "date"], { name: "idx_player_date" });

	// players_experience (36 MB, 930K rows)
	await context.addIndex("players_experience", ["playerId", "date"], { name: "idx_player_date" });

	// players_travels (27 MB, 727K rows)
	await context.addIndex("players_travels", ["playerId", "date"], { name: "idx_player_date" });
	await context.addIndex("players_travels", ["date"], { name: "idx_date" });

	// players_possibilities (25 MB, 677K rows)
	await context.addIndex("players_possibilities", ["playerId", "date"], { name: "idx_player_date" });

	// fights_actions_used (24 MB, 712K rows)
	await context.addIndex("fights_actions_used", ["fightId"], { name: "idx_fight" });

	// players_standard_alterations (20 MB, 527K rows)
	await context.addIndex("players_standard_alterations", ["playerId", "date"], { name: "idx_player_date" });

	// players_health (16 MB, 418K rows)
	await context.addIndex("players_health", ["playerId", "date"], { name: "idx_player_date" });

	// players_gems (9 MB, 224K rows)
	await context.addIndex("players_gems", ["playerId", "date"], { name: "idx_player_date" });

	// fights_results - for fight history queries
	await context.addIndex("fights_results", ["player1Id"], { name: "idx_player1" });
	await context.addIndex("fights_results", ["player2Id"], { name: "idx_player2" });
	await context.addIndex("fights_results", ["date"], { name: "idx_date" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("players_commands", "idx_date");
	await context.removeIndex("players_commands", "idx_player_date");
	await context.removeIndex("players_money", "idx_player_date");
	await context.removeIndex("players_small_events", "idx_player_date");
	await context.removeIndex("players_small_events", "idx_smallevent_date");
	await context.removeIndex("players_score", "idx_player_date");
	await context.removeIndex("players_experience", "idx_player_date");
	await context.removeIndex("players_travels", "idx_player_date");
	await context.removeIndex("players_travels", "idx_date");
	await context.removeIndex("players_possibilities", "idx_player_date");
	await context.removeIndex("fights_actions_used", "idx_fight");
	await context.removeIndex("players_standard_alterations", "idx_player_date");
	await context.removeIndex("players_health", "idx_player_date");
	await context.removeIndex("players_gems", "idx_player_date");
	await context.removeIndex("fights_results", "idx_player1");
	await context.removeIndex("fights_results", "idx_player2");
	await context.removeIndex("fights_results", "idx_date");
}
