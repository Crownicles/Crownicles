import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add index on player.guildId - commonly used for querying guild members
	await context.addIndex("players", ["guildId"], {
		name: "idx_players_guildId"
	});

	// Add index on guild_pets.petEntityId - commonly used for pet lookups
	await context.addIndex("guild_pets", ["petEntityId"], {
		name: "idx_guild_pets_petEntityId"
	});

	// Add index on guild_pets.guildId - commonly used for guild pet queries
	await context.addIndex("guild_pets", ["guildId"], {
		name: "idx_guild_pets_guildId"
	});

	// Add index on mission_slots.playerId - commonly used for player mission queries
	await context.addIndex("mission_slots", ["playerId"], {
		name: "idx_mission_slots_playerId"
	});

	// Add index on player.petId - commonly used for pet ownership queries
	await context.addIndex("players", ["petId"], {
		name: "idx_players_petId"
	});

	// Add index on player_badges.playerId - commonly used for badge queries
	await context.addIndex("player_badges", ["playerId"], {
		name: "idx_player_badges_playerId"
	});

	// Add index on player_talismans.playerId - commonly used for talisman queries
	await context.addIndex("player_talismans", ["playerId"], {
		name: "idx_player_talismans_playerId"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("players", "idx_players_guildId");
	await context.removeIndex("guild_pets", "idx_guild_pets_petEntityId");
	await context.removeIndex("guild_pets", "idx_guild_pets_guildId");
	await context.removeIndex("mission_slots", "idx_mission_slots_playerId");
	await context.removeIndex("players", "idx_players_petId");
	await context.removeIndex("player_badges", "idx_player_badges_playerId");
	await context.removeIndex("player_talismans", "idx_player_talismans_playerId");
}
