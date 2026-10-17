import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addIndex("players", ["keycloakId"], {
		name: "idx_players_keycloak"
	});
	await context.addIndex("pve_fights_results", [
		"playerId",
		"winner",
		"monsterId"
	], {
		name: "idx_pve_player_winner_monster"
	});
	await context.addIndex("pve_fights_results", [
		"monsterId",
		"winner",
		"monsterLevel",
		"turn",
		"date"
	], {
		name: "idx_pve_monster_winner_record"
	});
	await context.addIndex("pve_fights_actions_used", ["pveFightId", "actionId"], {
		name: "idx_pve_fight_action"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("pve_fights_actions_used", "idx_pve_fight_action");
	await context.removeIndex("pve_fights_results", "idx_pve_monster_winner_record");
	await context.removeIndex("pve_fights_results", "idx_pve_player_winner_monster");
	await context.removeIndex("players", "idx_players_keycloak");
}
