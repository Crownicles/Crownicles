import {
	describe, it, expect
} from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * This test ensures that all database tables containing personal data (playerId or keycloakId)
 * are properly exported in the GDPR export command.
 *
 * When adding a new table to the database, if it contains personal data (playerId or keycloakId),
 * you MUST either:
 * 1. Add it to the GDPR export in the appropriate exporter file
 * 2. Add it to the EXCLUDED_TABLES list with a justification comment
 *
 * This test will fail if a new table with personal data is added without being handled.
 */

// Tables containing playerId or keycloakId that are INTENTIONALLY NOT EXPORTED
// Each exclusion must have a documented reason
const EXCLUDED_TABLES = {
	// ============ GAME DATABASE ============
	// Reference/lookup tables (no personal data, just game configuration)
	"DailyMission": "Global daily mission, not player-specific",
	"Setting": "Global game settings, not player data",
	"FeralPet": "File is empty, table not used",

	// ============ LOGS DATABASE - Reference Tables ============
	// These are lookup/definition tables, not player activity logs
	"LogsAlterations": "Reference table: list of possible alterations (dictionary)",
	"LogsCommands": "Reference table: list of command names (dictionary)",
	"LogsCommandOrigins": "Reference table: command origin types (dictionary)",
	"LogsCommandSubOrigins": "Reference table: command sub-origin types (dictionary)",
	"LogsFightsActions": "Reference table: fight action definitions (dictionary)",
	"LogsItems": "Abstract base class, not a real table",
	"LogsMissions": "Reference table: mission definitions (dictionary)",
	"LogsMissionsDaily": "Global daily mission log, not player-specific",
	"LogsPossibilities": "Reference table: event possibility definitions (dictionary)",
	"LogsSmallEvents": "Reference table: small event definitions (dictionary)",
	"LogsMapLinks": "Reference table: map link definitions (dictionary)",
	"LogsPetEntities": "Reference table: pet entity ID mapping (dictionary)",

	// ============ LOGS DATABASE - Global/System Tables ============
	"LogsSeasonEnd": "Global season end timestamps, not player-specific",
	"LogsTopWeekEnd": "Global top week end timestamps, not player-specific",
	"LogsDailyPotions": "Global daily potion log, not player-specific",
	"LogsDailyTimeouts": "Global daily timeout log, not player-specific",
	"LogsPlayersNumbers": "Abstract base class, not a real table",
	"LogsShopBuyouts": "Abstract base class, not a real table",

	// ============ LOGS DATABASE - Guild-Only Tables ============
	// These tables are indexed by guildId only, not playerId
	// Guild data is collective, not individual personal data
	"LogsGuildsExperiences": "Guild collective data, indexed by guildId only",
	"LogsGuildsLevels": "Guild collective data, indexed by guildId only",
	"LogsGuildsPoints": "Guild collective data, indexed by guildId only",
	"LogsGuildsFoodsChanges": "Guild collective data, indexed by guildId only",
	"LogsGuildsDailies": "Guild collective data, indexed by guildId only",
	"LogsGuildsNewPets": "Guild collective data, indexed by guildId only",
	"LogsGuildsDestroys": "Guild collective data, indexed by guildId only"
};

// Tables that ARE EXPORTED in the GDPR export
// This list must be kept in sync with the exporters
const EXPORTED_TABLES = {
	// ============ GAME DATABASE (PlayerDataExporter) ============
	"Player": "01_player.csv",
	"PlayerBadges": "02_badges.csv",
	"InventorySlot": "03_inventory_slots.csv",
	"InventoryInfo": "04_inventory_info.csv",
	"MissionSlot": "05_mission_slots.csv",
	"PlayerMissionsInfo": "06_missions_info.csv",
	"PetEntity": "07_pet.csv",
	"PetExpedition": "08_pet_expeditions.csv",
	"PlayerSmallEvent": "09_small_events.csv",
	"PlayerTalismans": "10_talismans.csv",
	"DwarfPetsSeen": "11_dwarf_pets_seen.csv",
	"ScheduledDailyBonusNotification": "12_scheduled_notifications.csv",
	"ScheduledReportNotification": "12_scheduled_notifications.csv",
	"ScheduledExpeditionNotification": "12_scheduled_notifications.csv",
	"Guild": "13_guild_membership.csv (via player.guildId)",
	"GuildPet": "14_guild_pets.csv (via player.guildId)",

	// ============ LOGS DATABASE - Player Stats (LogsPlayerStatsExporter) ============
	"LogsPlayersScore": "logs/15_score_history.csv",
	"LogsPlayersLevel": "logs/16_level_history.csv",
	"LogsPlayersExperience": "logs/17_experience_history.csv",
	"LogsPlayersMoney": "logs/18_money_history.csv",
	"LogsPlayersHealth": "logs/19_health_history.csv",
	"LogsPlayersEnergy": "logs/20_energy_history.csv",
	"LogsPlayersGems": "logs/21_gems_history.csv",
	"LogsPlayersRage": "logs/22_rage_history.csv",
	"LogsPlayersTokens": "logs/23_tokens_history.csv",
	"LogsPlayersGloryPoints": "logs/24_glory_points_history.csv",
	"LogsPlayersClassChanges": "logs/25_class_changes.csv",
	"LogsPlayersTravels": "logs/26_travels.csv",
	"LogsPlayersTeleportations": "logs/27_teleportations.csv",
	"LogsPlayersTimewarps": "logs/28_timewarps.csv",
	"LogsPlayersPossibilities": "logs/29_event_possibilities.csv",
	"LogsPlayersSmallEvents": "logs/30_small_events.csv",
	"LogsPlayersStandardAlterations": "logs/31_standard_alterations.csv",
	"LogsPlayersOccupiedAlterations": "logs/32_occupied_alterations.csv",
	"LogsPlayersVotes": "logs/33_votes.csv",
	"LogsPlayersDailies": "logs/34_dailies.csv",

	// ============ LOGS DATABASE - Missions (LogsMissionsExporter) ============
	"LogsPlayersNewPets": "logs/35_pets_obtained.csv",
	"LogsPlayersCommands": "logs/36_commands_used.csv",
	"LogsPlayers15BestSeason": "logs/37_top15_season.csv",
	"LogsPlayers15BestTopweek": "logs/38_top15_topweek.csv",
	"LogsPlayerLeagueReward": "logs/39_league_rewards.csv",
	"LogsMissionsFound": "logs/40_missions_found.csv",
	"LogsMissionsFinished": "logs/41_missions_finished.csv",
	"LogsMissionsFailed": "logs/42_missions_failed.csv",
	"LogsMissionsDailyFinished": "logs/43_daily_missions_finished.csv",
	"LogsMissionsCampaignProgresses": "logs/44_campaign_progresses.csv",

	// ============ LOGS DATABASE - Fights (LogsFightsExporter) ============
	"LogsFightsResults": "logs/45_pvp_fights.csv",
	"LogsFightsActionsUsed": "logs/46_pvp_fight_actions.csv",
	"LogsPveFightsResults": "logs/47_pve_fights.csv",
	"LogsPveFightsActionsUsed": "logs/48_pve_fight_actions.csv",

	// ============ LOGS DATABASE - Shop (LogsShopExporter) ============
	"LogsClassicalShopBuyouts": "logs/49_classical_shop_buyouts.csv",
	"LogsGuildShopBuyouts": "logs/50_guild_shop_buyouts.csv",
	"LogsMissionShopBuyouts": "logs/51_mission_shop_buyouts.csv",
	"LogsItemGainsArmor": "logs/52_item_gains_armor.csv",
	"LogsItemGainsWeapon": "logs/53_item_gains_weapon.csv",
	"LogsItemGainsObject": "logs/54_item_gains_object.csv",
	"LogsItemGainsPotion": "logs/55_item_gains_potion.csv",
	"LogsItemSellsArmor": "logs/56_item_sells_armor.csv",
	"LogsItemSellsWeapon": "logs/57_item_sells_weapon.csv",
	"LogsItemSellsObject": "logs/58_item_sells_object.csv",
	"LogsItemSellsPotion": "logs/59_item_sells_potion.csv",

	// ============ LOGS DATABASE - Guild (LogsGuildExporter) ============
	"LogsGuildsCreations": "logs/60_guilds_created.csv",
	"LogsGuildsJoins": "logs/61_guilds_joined.csv",
	"LogsGuildsKicks": "logs/62_guilds_kicked.csv",
	"LogsGuildsLeaves": "logs/63_guilds_left.csv",
	"LogsGuildsChiefsChanges": "logs/64_became_guild_chief.csv",
	"LogsGuildsEldersAdds": "logs/65_became_guild_elder.csv",
	"LogsGuildsEldersRemoves": "logs/66_removed_guild_elder.csv",
	"LogsGuildsDescriptionChanges": "logs/67_guild_descriptions_written.csv",
	"LogsGuilds": "logs/74_guild_names_created.csv",

	// ============ LOGS DATABASE - Pets (LogsPetsExporter) ============
	"LogsPetsSells": "logs/68_pets_sold.csv and logs/69_pets_bought.csv",
	"LogsExpeditions": "logs/70_expeditions.csv",
	"LogsUnlocks": "logs/71_unlocks_bought.csv and logs/72_unlocks_received.csv",
	"LogsPetsNicknames": "logs/73_pet_nicknames.csv",

	// ============ LOGS DATABASE - Command Stats (LogsPlayerStatsExporter) ============
	"LogsPlayersCommandsStats": "logs/75_command_stats.csv",

	// ============ LOGS DATABASE - Players Reference ============
	"LogsPlayers": "Used for lookup only, keycloakId already in player export"
};

/**
 * Helper to extract model class names from a models directory
 */
function getModelNames(modelsDir: string): string[] {
	if (!fs.existsSync(modelsDir)) {
		return [];
	}

	const files = fs.readdirSync(modelsDir);
	return files
		.filter(file => file.endsWith(".ts") && !file.endsWith(".d.ts"))
		.map(file => {
			const content = fs.readFileSync(path.join(modelsDir, file), "utf-8");
			// Extract class name from "export class ClassName"
			const match = content.match(/export\s+class\s+(\w+)\s+extends\s+Model/);
			return match ? match[1] : null;
		})
		.filter((name): name is string => name !== null);
}

/**
 * Check if a model file contains playerId or keycloakId field
 */
function hasPersonalDataField(modelsDir: string, fileName: string): boolean {
	const filePath = path.join(modelsDir, fileName);
	if (!fs.existsSync(filePath)) {
		return false;
	}

	const content = fs.readFileSync(filePath, "utf-8");

	// Check for playerId or keycloakId declarations
	const hasPlayerId = /declare\s+(?:readonly\s+)?playerId\s*[?:]/.test(content)
		|| /playerId\s*:\s*{/.test(content);

	const hasKeycloakId = /declare\s+(?:readonly\s+)?keycloakId\s*[?:]/.test(content)
		|| /keycloakId\s*:\s*{/.test(content);

	// Also check for other player-related foreign keys
	const hasPlayerRef = /(?:fightInitiatorId|player2Id|addedId|adderId|kickedPlayer|leftPlayer|newChief|addedElder|removedElder|sellerId|buyerId|releasedId)\s*[?:]/.test(content)
		|| /(?:fightInitiatorId|player2Id|addedId|adderId|kickedPlayer|leftPlayer|newChief|addedElder|removedElder|sellerId|buyerId|releasedId)\s*:\s*{/.test(content);

	return hasPlayerId || hasKeycloakId || hasPlayerRef;
}

describe("GDPR Export Coverage", () => {
	const gameModelsDir = path.resolve(__dirname, "../../../../src/core/database/game/models");
	const logsModelsDir = path.resolve(__dirname, "../../../../src/core/database/logs/models");

	it("should have all game database tables with personal data accounted for", () => {
		const gameModels = getModelNames(gameModelsDir);
		const unaccountedTables: string[] = [];

		for (const modelName of gameModels) {
			const isExported = modelName in EXPORTED_TABLES;
			const isExcluded = modelName in EXCLUDED_TABLES;

			if (!isExported && !isExcluded) {
				// Check if it has personal data fields
				const fileName = `${modelName}.ts`;
				if (hasPersonalDataField(gameModelsDir, fileName)) {
					unaccountedTables.push(modelName);
				}
			}
		}

		expect(
			unaccountedTables,
			`The following game database tables contain personal data (playerId/keycloakId) but are not in the GDPR export:
${unaccountedTables.map(t => `  - ${t}`).join("\n")}

To fix this:
1. Add the table to the GDPR export in the appropriate exporter file
2. OR add it to EXCLUDED_TABLES in this test with a justification`
		).toEqual([]);
	});

	it("should have all logs database tables with personal data accounted for", () => {
		const logsModels = getModelNames(logsModelsDir);
		const unaccountedTables: string[] = [];

		for (const modelName of logsModels) {
			const isExported = modelName in EXPORTED_TABLES;
			const isExcluded = modelName in EXCLUDED_TABLES;

			if (!isExported && !isExcluded) {
				// Check if it has personal data fields
				const fileName = `${modelName}.ts`;
				if (hasPersonalDataField(logsModelsDir, fileName)) {
					unaccountedTables.push(modelName);
				}
			}
		}

		expect(
			unaccountedTables,
			`The following logs database tables contain personal data (playerId/keycloakId/player references) but are not in the GDPR export:
${unaccountedTables.map(t => `  - ${t}`).join("\n")}

To fix this:
1. Add the table to the GDPR export in the appropriate exporter file
2. OR add it to EXCLUDED_TABLES in this test with a justification`
		).toEqual([]);
	});

	it("should not have duplicate entries between EXPORTED_TABLES and EXCLUDED_TABLES", () => {
		const exportedNames = Object.keys(EXPORTED_TABLES);
		const excludedNames = Object.keys(EXCLUDED_TABLES);

		const duplicates = exportedNames.filter(name => excludedNames.includes(name));

		expect(
			duplicates,
			`The following tables are listed in both EXPORTED_TABLES and EXCLUDED_TABLES: ${duplicates.join(", ")}`
		).toEqual([]);
	});

	it("should have valid exclusion reasons (not empty)", () => {
		const emptyReasons = Object.entries(EXCLUDED_TABLES)
			.filter(([, reason]) => !reason || reason.trim() === "")
			.map(([name]) => name);

		expect(
			emptyReasons,
			`The following tables in EXCLUDED_TABLES have empty reasons: ${emptyReasons.join(", ")}`
		).toEqual([]);
	});
});
