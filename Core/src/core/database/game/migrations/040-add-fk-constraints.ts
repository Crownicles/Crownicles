import { QueryInterface } from "sequelize";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

// Error codes for table/constraint not found
const TABLE_NOT_FOUND_ERRNO = 1146;
const CONSTRAINT_NOT_FOUND_ERRNO = 1091;
const DUPLICATE_KEY_ERRNO = 1061;
const UNKNOWN_COLUMN_ERRNO = 1054;
const KEY_COLUMN_DOES_NOT_EXIST_ERRNO = 1072;
const CANT_CREATE_TABLE_ERRNO = 1005; // Duplicate FK name

const IGNORABLE_ERRNOS = [
	TABLE_NOT_FOUND_ERRNO,
	CONSTRAINT_NOT_FOUND_ERRNO,
	DUPLICATE_KEY_ERRNO,
	UNKNOWN_COLUMN_ERRNO,
	KEY_COLUMN_DOES_NOT_EXIST_ERRNO,
	CANT_CREATE_TABLE_ERRNO
];

/**
 * Safely execute a query, ignoring table not found or unknown column errors
 */
async function safeQuery(context: QueryInterface, sql: string): Promise<void> {
	try {
		await context.sequelize.query(sql);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (errno !== TABLE_NOT_FOUND_ERRNO && errno !== UNKNOWN_COLUMN_ERRNO) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 040: Ignoring error ${errno} for query: ${sql.substring(0, 100)}...`);

		// Table or column doesn't exist - that's fine, skip cleanup
	}
}

/**
 * Safely add a constraint, ignoring duplicate key or missing table/column errors
 */
async function safeAddConstraint(context: QueryInterface, tableName: string, options: Parameters<typeof context.addConstraint>[1]): Promise<void> {
	try {
		await context.addConstraint(tableName, options);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (errno === undefined || !IGNORABLE_ERRNOS.includes(errno)) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 040: Ignoring error ${errno} for addConstraint on ${tableName}`);

		// Table/column doesn't exist or constraint already exists - skip
	}
}

/**
 * Safely remove a constraint, ignoring not found errors
 */
async function safeRemoveConstraint(context: QueryInterface, tableName: string, constraintName: string): Promise<void> {
	try {
		await context.removeConstraint(tableName, constraintName);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (errno !== TABLE_NOT_FOUND_ERRNO && errno !== CONSTRAINT_NOT_FOUND_ERRNO) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 040: Ignoring error ${errno} for removeConstraint ${constraintName} on ${tableName}`);

		// Table or constraint doesn't exist - skip
	}
}

/**
 * This migration adds foreign key constraints to the database schema.
 * Before running, ensure data integrity by removing orphaned records.
 *
 * FK relationships:
 * - player_badges.playerId -> players.id
 * - player_talismans.playerId -> players.id
 * - mission_slots.playerId -> players.id
 * - inventory_slots.playerId -> players.id
 * - inventory_info.playerId -> players.id
 * - player_missions_info.playerId -> players.id
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
	await safeQuery(context, `
		DELETE FROM player_badges 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_talismans
	await safeQuery(context, `
		DELETE FROM player_talismans 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned mission_slots
	await safeQuery(context, `
		DELETE FROM mission_slots 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned inventory_slots
	await safeQuery(context, `
		DELETE FROM inventory_slots 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned inventory_info
	await safeQuery(context, `
		DELETE FROM inventory_info 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_missions_infos
	await safeQuery(context, `
		DELETE FROM player_missions_infos 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_small_events
	await safeQuery(context, `
		DELETE FROM player_small_events 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned player_active_objects
	await safeQuery(context, `
		DELETE FROM player_active_objects 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_report_notifications
	await safeQuery(context, `
		DELETE FROM scheduled_report_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_expedition_notifications
	await safeQuery(context, `
		DELETE FROM scheduled_expedition_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned scheduled_daily_bonus_notifications
	await safeQuery(context, `
		DELETE FROM scheduled_daily_bonus_notifications 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned guild_pets (guildId)
	await safeQuery(context, `
		DELETE FROM guild_pets 
		WHERE guildId NOT IN (SELECT id FROM guilds)
	`);

	// Clean orphaned guild_pets (petEntityId)
	await safeQuery(context, `
		DELETE FROM guild_pets 
		WHERE petEntityId NOT IN (SELECT id FROM pet_entities)
	`);

	// Clean orphaned pet_expeditions
	await safeQuery(context, `
		DELETE FROM pet_expeditions 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Clean orphaned dwarf_pets_seen
	await safeQuery(context, `
		DELETE FROM dwarf_pets_seen 
		WHERE playerId NOT IN (SELECT id FROM players)
	`);

	// Set invalid player.guildId to NULL
	await safeQuery(context, `
		UPDATE players SET guildId = NULL 
		WHERE guildId IS NOT NULL AND guildId NOT IN (SELECT id FROM guilds)
	`);

	// Set invalid player.petId to NULL
	await safeQuery(context, `
		UPDATE players SET petId = NULL 
		WHERE petId IS NOT NULL AND petId NOT IN (SELECT id FROM pet_entities)
	`);

	// Now add FK constraints

	// Player-related FKs with CASCADE delete (when player is deleted, related data is deleted)
	await safeAddConstraint(context, "player_badges", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_badges_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "player_talismans", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_talismans_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "mission_slots", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_mission_slots_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "inventory_slots", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_inventory_slots_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "inventory_info", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_inventory_info_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "player_missions_infos", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_missions_infos_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "player_small_events", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_small_events_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "player_active_objects", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_active_objects_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "scheduled_report_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_report_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "scheduled_expedition_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_expedition_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "scheduled_daily_bonus_notifications", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_scheduled_daily_bonus_notifications_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "pet_expeditions", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_pet_expeditions_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "dwarf_pets_seen", {
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
	await safeAddConstraint(context, "guild_pets", {
		fields: ["guildId"],
		type: "foreign key",
		name: "fk_guild_pets_guildId",
		references: {
			table: "guilds", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "guild_pets", {
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
	await safeAddConstraint(context, "players", {
		fields: ["guildId"],
		type: "foreign key",
		name: "fk_players_guildId",
		references: {
			table: "guilds", field: "id"
		},
		onDelete: "SET NULL",
		onUpdate: "CASCADE"
	});

	await safeAddConstraint(context, "players", {
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
	await safeRemoveConstraint(context, "player_badges", "fk_player_badges_playerId");
	await safeRemoveConstraint(context, "player_talismans", "fk_player_talismans_playerId");
	await safeRemoveConstraint(context, "mission_slots", "fk_mission_slots_playerId");
	await safeRemoveConstraint(context, "inventory_slots", "fk_inventory_slots_playerId");
	await safeRemoveConstraint(context, "inventory_info", "fk_inventory_info_playerId");
	await safeRemoveConstraint(context, "player_missions_infos", "fk_player_missions_infos_playerId");
	await safeRemoveConstraint(context, "player_small_events", "fk_player_small_events_playerId");
	await safeRemoveConstraint(context, "player_active_objects", "fk_player_active_objects_playerId");
	await safeRemoveConstraint(context, "scheduled_report_notifications", "fk_scheduled_report_notifications_playerId");
	await safeRemoveConstraint(context, "scheduled_expedition_notifications", "fk_scheduled_expedition_notifications_playerId");
	await safeRemoveConstraint(context, "scheduled_daily_bonus_notifications", "fk_scheduled_daily_bonus_notifications_playerId");
	await safeRemoveConstraint(context, "pet_expeditions", "fk_pet_expeditions_playerId");
	await safeRemoveConstraint(context, "dwarf_pets_seen", "fk_dwarf_pets_seen_playerId");
	await safeRemoveConstraint(context, "guild_pets", "fk_guild_pets_guildId");
	await safeRemoveConstraint(context, "guild_pets", "fk_guild_pets_petEntityId");
	await safeRemoveConstraint(context, "players", "fk_players_guildId");
	await safeRemoveConstraint(context, "players", "fk_players_petId");
}
