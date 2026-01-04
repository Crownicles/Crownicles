import { QueryInterface } from "sequelize";

/**
 * This migration adds foreign key constraints to the database schema.
 * Before running, ensure data integrity by removing orphaned records.
 *
 * FK relationships:
 * - player_badges.playerId -> players.id
 * - player_talismans.playerId -> players.id
 * - mission_slots.playerId -> players.id
 * - inventory_slots.playerId -> players.id
 * - inventory_infos.playerId -> players.id
 * - player_missions_infos.playerId -> players.id
 * - player_small_events.playerId -> players.id
 * - player_active_objects.playerId -> players.id
 * - scheduled_report_notifications.playerId -> players.id
 * - scheduled_expedition_notifications.playerId -> players.id
 * - scheduled_daily_bonus_notifications.playerId -> players.id
 * - guild_pets.guildId -> guilds.id
 * - guild_pets.petEntityId -> pet_entities.id
 * - players.guildId -> guilds.id (nullable)
 * - players.petId -> pet_entities.id (nullable)
 * - pet_expeditions.playerId -> players.id
 * - dwarf_pets_seen.playerId -> players.id
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// First, clean up orphaned records before adding FK constraints

	// Clean orphaned player_badges
	await context.sequelize.query(`
		DELETE FROM player_badges 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_talismans
	await context.sequelize.query(`
		DELETE FROM player_talismans 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned mission_slots
	await context.sequelize.query(`
		DELETE FROM mission_slots 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned inventory_slots
	await context.sequelize.query(`
		DELETE FROM inventory_slots 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned inventory_infos
	await context.sequelize.query(`
		DELETE FROM inventory_infos 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_missions_infos
	await context.sequelize.query(`
		DELETE FROM player_missions_infos 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_small_events
	await context.sequelize.query(`
		DELETE FROM player_small_events 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_active_objects
	await context.sequelize.query(`
		DELETE FROM player_active_objects 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_report_notifications
	await context.sequelize.query(`
		DELETE FROM scheduled_report_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_expedition_notifications
	await context.sequelize.query(`
		DELETE FROM scheduled_expedition_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_daily_bonus_notifications
	await context.sequelize.query(`
		DELETE FROM scheduled_daily_bonus_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned guild_pets (guildId)
	await context.sequelize.query(`
		DELETE FROM guild_pets 
		WHERE guildId NOT IN (SELECT id FROM guilds)
	`);

	// Clean orphaned guild_pets (petEntityId)
	await context.sequelize.query(`
		DELETE FROM guild_pets 
		WHERE petEntityId NOT IN (SELECT id FROM pet_entities)
	`);

	// Clean orphaned pet_expeditions
	await context.sequelize.query(`
		DELETE FROM pet_expeditions 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned dwarf_pets_seen
	await context.sequelize.query(`
		DELETE FROM dwarf_pets_seen 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Set invalid player.guildId to NULL
	await context.sequelize.query(`
		UPDATE players SET guildId = NULL 
		WHERE guildId IS NOT NULL AND guildId NOT IN (SELECT id FROM guilds)
	`);

	// Set invalid player.petId to NULL
	await context.sequelize.query(`
		UPDATE players SET petId = NULL 
		WHERE petId IS NOT NULL AND petId NOT IN (SELECT id FROM pet_entities)
	`);

	// Now add FK constraints

	// Player-related FKs with CASCADE delete (when player is deleted, related data is deleted)
	await context.addConstraint("player_badges", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_badges_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("player_talismans", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_talismans_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("mission_slots", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_mission_slots_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("inventory_slots", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_inventory_slots_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("inventory_infos", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_inventory_infos_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("player_missions_infos", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_missions_infos_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("player_small_events", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_small_events_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("player_active_objects", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_active_objects_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("scheduled_report_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_report_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("scheduled_expedition_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_expedition_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("scheduled_daily_bonus_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_daily_bonus_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("pet_expeditions", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_pet_expeditions_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("dwarf_pets_seen", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_dwarf_pets_seen_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	// Guild pet FKs
	await context.addConstraint("guild_pets", {
		fields: ["guildId"],
		type: "foreign key",
		name: "fk_guild_pets_guildId",
		references: {
			table: "guilds", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("guild_pets", {
		fields: ["petEntityId"],
		type: "foreign key",
		name: "fk_guild_pets_petEntityId",
		references: {
			table: "pet_entities", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	// Player optional references (SET NULL on delete)
	await context.addConstraint("players", {
		fields: ["guildId"],
		type: "foreign key",
		name: "fk_players_guildId",
		references: {
			table: "guilds", field: "id"
		},
		onDelete: "SET NULL",
		onUpdate: "CASCADE"
	});

	await context.addConstraint("players", {
		fields: ["petId"],
		type: "foreign key",
		name: "fk_players_petId",
		references: {
			table: "pet_entities", field: "id"
		},
		onDelete: "SET NULL",
		onUpdate: "CASCADE"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Remove all FK constraints
	await context.removeConstraint("player_badges", "fk_player_badges_playerId");
	await context.removeConstraint("player_talismans", "fk_player_talismans_playerId");
	await context.removeConstraint("mission_slots", "fk_mission_slots_playerId");
	await context.removeConstraint("inventory_slots", "fk_inventory_slots_playerId");
	await context.removeConstraint("inventory_infos", "fk_inventory_infos_playerId");
	await context.removeConstraint("player_missions_infos", "fk_player_missions_infos_playerId");
	await context.removeConstraint("player_small_events", "fk_player_small_events_playerId");
	await context.removeConstraint("player_active_objects", "fk_player_active_objects_playerId");
	await context.removeConstraint("scheduled_report_notifications", "fk_scheduled_report_notifications_playerId");
	await context.removeConstraint("scheduled_expedition_notifications", "fk_scheduled_expedition_notifications_playerId");
	await context.removeConstraint("scheduled_daily_bonus_notifications", "fk_scheduled_daily_bonus_notifications_playerId");
	await context.removeConstraint("pet_expeditions", "fk_pet_expeditions_playerId");
	await context.removeConstraint("dwarf_pets_seen", "fk_dwarf_pets_seen_playerId");
	await context.removeConstraint("guild_pets", "fk_guild_pets_guildId");
	await context.removeConstraint("guild_pets", "fk_guild_pets_petEntityId");
	await context.removeConstraint("players", "fk_players_guildId");
	await context.removeConstraint("players", "fk_players_petId");
}
