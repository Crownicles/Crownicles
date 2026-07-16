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

// ============================================================================
// FORBIDDEN FIELDS - These should NEVER appear in exports without anonymization
// ============================================================================
const FORBIDDEN_EXPORT_FIELDS = {
	// Raw identifiers that could identify users
	"discordId": "Discord user ID - should never be exported (Discord service only)",
	"discordUserId": "Discord user ID - should never be exported",
	"discordChannelId": "Discord channel ID - not personal data but should not be exported",
	"email": "Email address - should never be exported",
	"ipAddress": "IP address - should never be exported",
	"ip": "IP address - should never be exported",

	// Security-related fields
	"password": "Password hash - should never be exported",
	"passwordHash": "Password hash - should never be exported",
	"token": "Authentication token - should never be exported",
	"accessToken": "Access token - should never be exported",
	"refreshToken": "Refresh token - should never be exported",
	"secret": "Secret key - should never be exported",

	// Fields that should be anonymized, not exported raw
	// Note: keycloakId of the requesting player IS exported as a hash, but others are REDACTED
	// These are allowed when properly anonymized via GDPRAnonymizer
	"banned": "Ban status - administrative decision, not personal data under GDPR Art. 15"
};

// Fields that ARE allowed but must use anonymization
const FIELDS_REQUIRING_ANONYMIZATION = [
	"playerId", // Must use anonymizePlayerId()
	"keycloakId", // Must use anonymizeKeycloakId() or getAnonymizedPlayerId()
	"guildId", // Must use anonymizeGuildId()
	"fightInitiatorId", // Must use anonymizePlayerId()
	"player2Id", // Must use anonymizePlayerId()
	"addedId", // Must use anonymizePlayerId()
	"adderId", // Must use anonymizePlayerId()
	"kickedPlayer", // Must use anonymizePlayerId()
	"leftPlayer", // Must use anonymizePlayerId()
	"newChief", // Must use anonymizePlayerId()
	"addedElder", // Must use anonymizePlayerId()
	"removedElder", // Must use anonymizePlayerId()
	"sellerId", // Must use anonymizePlayerId()
	"buyerId", // Must use anonymizePlayerId()
	"releasedId", // Must use anonymizePlayerId()
	"triggeredByPlayerId" // Must use anonymizePlayerId()
];

// Tables containing playerId or keycloakId that are INTENTIONALLY NOT EXPORTED
// Each exclusion must have a documented reason
const EXCLUDED_TABLES = {
	// ============ GAME DATABASE ============
	// Reference/lookup tables (no personal data, just game configuration)
	"DailyMission": "Global daily mission, not player-specific",
	"Setting": "Global game settings, not player data",

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
	"Guild": "13_guild_membership.csv",
	"GuildPet": "14_guild_pets.csv",
	"Material": "15_materials.csv",
	"Home": "16_home.csv",
	"PlayerPlantSlot": "17_plant_slots.csv",
	"HomeChestSlot": "18_home_chest_slots.csv",
	"HomeGardenSlot": "19_home_garden_slots.csv",
	"HomePlantStorage": "20_home_plant_storage.csv",
	"Apartment": "21_apartments.csv",
	"PlayerCookingRecipe": "22_cooking_recipes.csv",

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

	// ============ LOGS DATABASE - Blessings (LogsBlessingsExporter) ============
	"LogsBlessings": "logs/76_blessings_triggered.csv",
	"LogsBlessingsContributions": "logs/77_blessings_contributions.csv",

	// ============ LOGS DATABASE - City (LogsCityExporter) ============
	"LogsInnMeals": "logs/78_inn_meals.csv",
	"LogsInnRooms": "logs/79_inn_rooms.csv",
	"LogsBlacksmithUpgrades": "logs/80_blacksmith_upgrades.csv",
	"LogsBlacksmithDisenchants": "logs/81_blacksmith_disenchants.csv",
	"LogsEnchanterUses": "logs/82_enchanter_uses.csv",
	"LogsHomePurchases": "logs/83_home_purchases.csv",
	"LogsHomeUpgrades": "logs/84_home_upgrades.csv",
	"LogsHomeMoves": "logs/85_home_moves.csv",
	"LogsHomeBedUses": "logs/86_home_bed_uses.csv",
	"LogsApartmentPurchases": "logs/87_apartment_purchases.csv",
	"LogsApartmentRentClaims": "logs/88_apartment_rent_claims.csv",
	"LogsGuildDomainPurchases": "logs/89_guild_domain_purchases.csv",
	"LogsGuildDomainUpgrades": "logs/90_guild_domain_upgrades.csv",
	"LogsGuildTreasuryDeposits": "logs/91_guild_treasury_deposits.csv",
	"LogsGuildFoodShopBuys": "logs/92_guild_food_shop_buys.csv",
	"LogsCookingUses": "logs/93_cooking_uses.csv",
	"LogsGardenActions": "logs/94_garden_actions.csv",
	"LogsCityVisits": "logs/95_city_visits.csv",

	// ============ LOGS DATABASE - Players Reference ============
	"LogsPlayers": "Used for lookup only, keycloakId already in player export"
};

const INDIRECT_GAME_PLAYER_REF_FIELDS = [
	"ownerId",
	"homeId"
] as const;

const PLAYER_DATA_EXPORT_FIELD_COVERAGE = {
	"Player": [
		"fightPointsLost",
		"score",
		"weeklyScore",
		"level",
		"experience",
		"money",
		"tokens",
		"class",
		"guildId",
		"nextEvent",
		"lastPetFree",
		"effectId",
		"effectEndDate",
		"effectDuration",
		"mapLinkId",
		"startTravelDate",
		"insideCity",
		"lastActivityAt",
		"defenseGloryPoints",
		"attackGloryPoints",
		"gloryPointsLastSeason",
		"fightCountdown",
		"rage",
		"lastMealAt",
		"cookingLevel",
		"cookingExperience",
		"lastBedUsedAt",
		"furnacePosition",
		"pinnedCookingRecipeId",
		"lastGardenWatered",
		"updatedAt",
		"createdAt"
	],
	"InventorySlot": [
		"slot",
		"itemCategory",
		"itemId",
		"itemLevel",
		"itemEnchantmentId",
		"remainingPotionUsages",
		"updatedAt",
		"createdAt"
	],
	"InventoryInfo": [
		"lastDailyAt",
		"weaponSlots",
		"armorSlots",
		"objectSlots",
		"potionSlots",
		"plantSlots",
		"updatedAt",
		"createdAt"
	],
	"PlayerMissionsInfo": [
		"gems",
		"hasBoughtPointsThisWeek",
		"missionSkipsUsedThisWeek",
		"dailyMissionNumberDone",
		"lastDailyMissionCompleted",
		"dailyMissionBlob",
		"campaignProgression",
		"campaignBlob",
		"updatedAt",
		"createdAt"
	],
	"Material": [
		"materialId",
		"quantity",
		"createdAt",
		"updatedAt"
	],
	"Home": [
		"cityId",
		"level",
		"createdAt",
		"updatedAt"
	],
	"PlayerPlantSlot": [
		"slotType",
		"slot",
		"plantId",
		"createdAt",
		"updatedAt"
	],
	"HomeChestSlot": [
		"slot",
		"itemCategory",
		"itemId",
		"itemLevel",
		"itemEnchantmentId",
		"createdAt",
		"updatedAt"
	],
	"HomeGardenSlot": [
		"slot",
		"plantId",
		"plantedAt",
		"createdAt",
		"updatedAt"
	],
	"HomePlantStorage": [
		"plantId",
		"quantity",
		"createdAt",
		"updatedAt"
	],
	"Apartment": [
		"cityId",
		"purchasePrice",
		"lastRentClaimedAt",
		"createdAt",
		"updatedAt"
	],
	"PlayerCookingRecipe": [
		"recipeId",
		"sourceMapId"
	]
} as const;

const PLAYER_DATA_MODEL_IGNORED_FIELDS = {
	"Player": [
		"id",
		"keycloakId",
		"health",
		"petId",
		"banned"
	],
	"InventorySlot": ["playerId"],
	"InventoryInfo": ["playerId"],
	"PlayerMissionsInfo": ["playerId"],
	"Material": ["playerId"],
	"Home": [
		"id",
		"ownerId"
	],
	"PlayerPlantSlot": ["playerId"],
	"HomeChestSlot": ["homeId"],
	"HomeGardenSlot": ["homeId"],
	"HomePlantStorage": ["homeId"],
	"Apartment": [
		"id",
		"ownerId"
	],
	"PlayerCookingRecipe": ["playerId"]
} as const;

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
function hasPersonalDataField(modelsDir: string, fileName: string, includeIndirectRefs = false): boolean {
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
	const hasPlayerRef = /(?:fightInitiatorId|player2Id|addedId|adderId|kickedPlayer|leftPlayer|newChief|addedElder|removedElder|sellerId|buyerId|releasedId|triggeredByPlayerId)\s*[?:]/.test(content)
		|| /(?:fightInitiatorId|player2Id|addedId|adderId|kickedPlayer|leftPlayer|newChief|addedElder|removedElder|sellerId|buyerId|releasedId|triggeredByPlayerId)\s*:\s*{/.test(content);
	const hasIndirectPlayerRef = includeIndirectRefs && INDIRECT_GAME_PLAYER_REF_FIELDS.some(field => new RegExp(`declare\\s+(?:readonly\\s+)?${field}\\s*[?:]`).test(content)
		|| new RegExp(`${field}\\s*:\\s*{`).test(content));

	return hasPlayerId || hasKeycloakId || hasPlayerRef || hasIndirectPlayerRef;
}

function getModelFieldNames(modelsDir: string, modelName: string): string[] {
	const filePath = path.join(modelsDir, `${modelName}.ts`);
	const content = fs.readFileSync(filePath, "utf-8");
	const matches = content.matchAll(/declare\s+(?:readonly\s+|private\s+)?(\w+)\s*:/g);

	return [...matches].map(match => match[1]);
}

function exporterReferencesField(exporterContent: string, fieldName: string): boolean {
	return new RegExp(`\\b${fieldName}\\s*:`).test(exporterContent)
		|| new RegExp(`\\.${fieldName}\\b`).test(exporterContent);
}

function getCsvExportBlock(exporterContent: string, csvFileName: string): string {
	const csvAssignment = `csvFiles["${csvFileName}"]`;
	const startIndex = exporterContent.indexOf(csvAssignment);
	if (startIndex === -1) {
		return "";
	}

	const nextCsvAssignmentIndex = exporterContent.indexOf("csvFiles[", startIndex + csvAssignment.length);
	return exporterContent.slice(startIndex, nextCsvAssignmentIndex === -1 ? undefined : nextCsvAssignmentIndex);
}

function getIgnoredModelFields(modelName: string): readonly string[] {
	return PLAYER_DATA_MODEL_IGNORED_FIELDS[modelName as keyof typeof PLAYER_DATA_MODEL_IGNORED_FIELDS] ?? [];
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
				if (hasPersonalDataField(gameModelsDir, fileName, true)) {
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

	it("should export tracked fields from player data models", () => {
		const exporterPath = path.resolve(__dirname, "../../../../src/commands/admin/gdpr/exporters/PlayerDataExporter.ts");
		const exporterContent = fs.readFileSync(exporterPath, "utf-8");
		const missingFields: string[] = [];

		for (const [modelName, fieldNames] of Object.entries(PLAYER_DATA_EXPORT_FIELD_COVERAGE)) {
			const modelFields = getModelFieldNames(gameModelsDir, modelName);
			const csvFileName = EXPORTED_TABLES[modelName as keyof typeof EXPORTED_TABLES];
			const csvExportBlock = getCsvExportBlock(exporterContent, csvFileName);
			const trackedFields = new Set<string>(fieldNames);
			const ignoredFields = new Set<string>(getIgnoredModelFields(modelName));
			const untrackedFields = modelFields.filter(field => !trackedFields.has(field) && !ignoredFields.has(field));

			for (const fieldName of untrackedFields) {
				missingFields.push(`${modelName}.${fieldName} is neither exported nor explicitly ignored`);
			}

			for (const fieldName of fieldNames) {
				if (!modelFields.includes(fieldName)) {
					missingFields.push(`${modelName}.${fieldName} is listed for GDPR coverage but no longer exists`);
					continue;
				}

				if (!exporterReferencesField(csvExportBlock, fieldName)) {
					missingFields.push(`${modelName}.${fieldName}`);
				}
			}
		}

		expect(
			missingFields,
			`The following player data fields are tracked for GDPR export coverage but are missing from PlayerDataExporter:
${missingFields.map(field => `  - ${field}`).join("\n")}

Add each field to PlayerDataExporter or remove it from PLAYER_DATA_EXPORT_FIELD_COVERAGE with a justification.`
		).toEqual([]);
	});
});

/**
 * GDPR Data Leak Prevention Tests
 *
 * These tests analyze the exporter source code to ensure no sensitive
 * fields are exported without proper anonymization.
 */
describe("GDPR Export Data Leak Prevention", () => {
	const exportersDir = path.resolve(__dirname, "../../../../src/commands/admin/gdpr/exporters");

	/**
	 * Get all exporter files
	 */
	function getExporterFiles(): string[] {
		if (!fs.existsSync(exportersDir)) {
			return [];
		}
		return fs.readdirSync(exportersDir)
			.filter(file => file.endsWith(".ts") && !file.endsWith(".d.ts"));
	}

	/**
	 * Check if an exporter file exports a forbidden field directly (without anonymization)
	 * This looks for patterns like `fieldName: row.forbiddenField` in transform functions
	 */
	function findForbiddenFieldExports(filePath: string): { field: string; reason: string }[] {
		const content = fs.readFileSync(filePath, "utf-8");
		const violations: { field: string; reason: string }[] = [];

		for (const [field, reason] of Object.entries(FORBIDDEN_EXPORT_FIELDS)) {
			// Check for direct field access patterns in export mappings
			// Patterns like: `fieldName: something.forbiddenField` or `forbiddenField: value`
			const directExportPattern = new RegExp(
				`(?:\\b${field}\\s*:|:\\s*\\w+\\.${field}\\b)(?![\\w])`,
				"gi"
			);

			if (directExportPattern.test(content)) {
				violations.push({ field, reason });
			}
		}

		return violations;
	}

	/**
	 * Check that player references use anonymization
	 * Looks for fields that should use anonymizePlayerId but might not
	 */
	function findUnAnonymizedPlayerReferences(filePath: string): string[] {
		const content = fs.readFileSync(filePath, "utf-8");
		const violations: string[] = [];

		for (const field of FIELDS_REQUIRING_ANONYMIZATION) {
			// Look for the field being used in an export context
			const fieldUsagePattern = new RegExp(`[.\\s]${field}[,\\s)}]`, "g");
			const matches = content.match(fieldUsagePattern);

			if (matches) {
				const directExportCheck = new RegExp(
					`\\b${field}\\s*:\\s*(?:\\w+\\.)?${field}\\b`,
					"g"
				);
				const directExports = [...content.matchAll(directExportCheck)]
					.filter(match => !content.slice(Math.max(0, (match.index ?? 0) - 20), match.index)
						.match(/where:\s*{\s*$/));
				if (directExports.length > 0) {
					violations.push(field);
					continue;
				}

				// Check if this field usage is also accompanied by anonymization
				// We look for anonymize calls on the same field nearby
				const anonymizePatterns = [
					new RegExp(`anonymizePlayerId\\([^)]*${field}`, "g"),
					new RegExp(`anonymizeKeycloakId\\([^)]*${field}`, "g"),
					new RegExp(`anonymizeGuildId\\([^)]*${field}`, "g"),
					new RegExp(`getAnonymizedPlayerId\\(`, "g")
				];

				const hasAnonymization = anonymizePatterns.some(pattern => pattern.test(content));

				// Special case: if the field is used but the file doesn't have ANY anonymization
				// and the file uses these fields, it might be a problem
				// However, for most cases we can't perfectly detect this statically
				// So we do a simpler check: if the file exports these fields AND doesn't import GDPRAnonymizer

				if (!content.includes("GDPRAnonymizer") && !hasAnonymization) {
					// Check if the field is being directly exported
					const fallbackDirectExportCheck = new RegExp(
						`\\b${field}\\s*:\\s*(?:\\w+\\.)?${field}\\b`,
						"g"
					);
					if (fallbackDirectExportCheck.test(content)) {
						violations.push(field);
					}
				}
			}
		}

		return [...new Set(violations)];
	}

	it("should not export forbidden fields in any exporter", () => {
		const exporterFiles = getExporterFiles();
		const allViolations: { file: string; field: string; reason: string }[] = [];

		for (const file of exporterFiles) {
			const filePath = path.join(exportersDir, file);
			const violations = findForbiddenFieldExports(filePath);

			for (const violation of violations) {
				allViolations.push({
					file,
					field: violation.field,
					reason: violation.reason
				});
			}
		}

		expect(
			allViolations,
			`The following forbidden fields are being exported without proper handling:
${allViolations.map(v => `  - ${v.file}: "${v.field}" - ${v.reason}`).join("\n")}

To fix this:
1. Remove the field from the export
2. OR if it's actually safe, add an exception with documentation`
		).toEqual([]);
	});

	it("should anonymize all player-identifying fields", () => {
		const exporterFiles = getExporterFiles();
		const allViolations: { file: string; fields: string[] }[] = [];

		for (const file of exporterFiles) {
			const filePath = path.join(exportersDir, file);
			const violations = findUnAnonymizedPlayerReferences(filePath);

			if (violations.length > 0) {
				allViolations.push({ file, fields: violations });
			}
		}

		expect(
			allViolations,
			`The following files may export player-identifying fields without anonymization:
${allViolations.map(v => `  - ${v.file}: ${v.fields.join(", ")}`).join("\n")}

Player IDs and references must be anonymized using GDPRAnonymizer:
- Use anonymizePlayerId() for other players (returns "OTHER_PLAYER_X")
- Use getAnonymizedPlayerId() for the requesting player's own ID
- Use anonymizeGuildId() for guild IDs`
		).toEqual([]);
	});

	it("should only export data that belongs to the requesting player", () => {
		// This test verifies the export logic by checking that queries filter by playerId
		const exporterFiles = getExporterFiles();
		const filesWithoutPlayerFilter: string[] = [];

		for (const file of exporterFiles) {
			const filePath = path.join(exportersDir, file);
			const content = fs.readFileSync(filePath, "utf-8");

			// Skip PlayerDataExporter as it uses the player object directly
			if (file === "PlayerDataExporter.ts") {
				continue;
			}

			// Check that the file uses playerId in queries
			const hasPlayerIdFilter =
				content.includes("playerId") ||
				content.includes("logsPlayerId") ||
				content.includes("playerIdWhere");

			// Also check for explicit player-scoped queries
			const hasExplicitPlayerQuery =
				content.includes("where: { playerId") ||
				content.includes("where: playerIdWhere") ||
				content.includes("{ playerId: logsPlayerId }");

			if (!hasPlayerIdFilter && !hasExplicitPlayerQuery) {
				filesWithoutPlayerFilter.push(file);
			}
		}

		expect(
			filesWithoutPlayerFilter,
			`The following exporters may not properly filter by player ID:
${filesWithoutPlayerFilter.map(f => `  - ${f}`).join("\n")}

All GDPR exports must only include data belonging to the requesting player.
Ensure queries filter by playerId or logsPlayerId.`
		).toEqual([]);
	});
});
