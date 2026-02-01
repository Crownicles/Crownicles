import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	fetchWithPagination, GDPRCsvFiles, streamToCSV, toCSV
} from "../CSVUtils";
import { LogsGuildsCreations } from "../../../../core/database/logs/models/LogsGuildCreations";
import { LogsGuildsJoins } from "../../../../core/database/logs/models/LogsGuildJoins";
import { LogsGuildsKicks } from "../../../../core/database/logs/models/LogsGuildsKicks";
import { LogsGuildsLeaves } from "../../../../core/database/logs/models/LogsGuildsLeaves";
import { LogsGuildsChiefsChanges } from "../../../../core/database/logs/models/LogsGuildsChiefsChanges";
import { LogsGuildsEldersAdds } from "../../../../core/database/logs/models/LogsGuildsEldersAdds";
import { LogsGuildsEldersRemoves } from "../../../../core/database/logs/models/LogsGuildsEldersRemoves";
import { LogsGuildsDescriptionChanges } from "../../../../core/database/logs/models/LogsGuildsDescriptionChanges";
import { LogsGuilds } from "../../../../core/database/logs/models/LogsGuilds";
import { Op } from "sequelize";

/**
 * Result containing guilds created data for use by other exporters
 */
export interface LogsGuildExportResult {
	guildsCreated: Awaited<ReturnType<typeof LogsGuildsCreations.findAll>>;
}

/**
 * Exports guild membership events (joined, kicked, left)
 */
async function exportGuildMembershipEvents(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const guildsJoinedCsv = await streamToCSV(
		LogsGuildsJoins,
		{ addedId: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId),
			addedBy: anonymizer.anonymizePlayerId(g.adderId, false),
			date: g.date
		})
	);
	if (guildsJoinedCsv) {
		csvFiles["logs/61_guilds_joined.csv"] = guildsJoinedCsv;
	}

	const guildsKickedCsv = await streamToCSV(
		LogsGuildsKicks,
		{ kickedPlayer: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})
	);
	if (guildsKickedCsv) {
		csvFiles["logs/62_guilds_kicked.csv"] = guildsKickedCsv;
	}

	const guildsLeftCsv = await streamToCSV(
		LogsGuildsLeaves,
		{ leftPlayer: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})
	);
	if (guildsLeftCsv) {
		csvFiles["logs/63_guilds_left.csv"] = guildsLeftCsv;
	}
}

/**
 * Exports guild role changes (chief, elder)
 */
async function exportGuildRoleChanges(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const becameChiefCsv = await streamToCSV(
		LogsGuildsChiefsChanges,
		{ newChief: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})
	);
	if (becameChiefCsv) {
		csvFiles["logs/64_became_guild_chief.csv"] = becameChiefCsv;
	}

	const becameElderCsv = await streamToCSV(
		LogsGuildsEldersAdds,
		{ addedElder: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})
	);
	if (becameElderCsv) {
		csvFiles["logs/65_became_guild_elder.csv"] = becameElderCsv;
	}

	const removedElderCsv = await streamToCSV(
		LogsGuildsEldersRemoves,
		{ removedElder: logsPlayerId },
		g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})
	);
	if (removedElderCsv) {
		csvFiles["logs/66_removed_guild_elder.csv"] = removedElderCsv;
	}
}

/**
 * Exports guild descriptions written by the player
 */
async function exportGuildDescriptions(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const descriptionsWrittenCsv = await streamToCSV(
		LogsGuildsDescriptionChanges,
		{ playerId: logsPlayerId },
		d => ({
			guildId: anonymizer.anonymizeGuildId(d.guildId),
			description: d.description,
			date: d.date
		})
	);
	if (descriptionsWrittenCsv) {
		csvFiles["logs/67_guild_descriptions_written.csv"] = descriptionsWrittenCsv;
	}
}

/**
 * Exports guild-related data from logs database (files 60-67, 74)
 */
export async function exportLogsGuild(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<LogsGuildExportResult> {
	// 60. Guilds created
	const guildsCreated = await fetchWithPagination(
		LogsGuildsCreations,
		{ creatorId: logsPlayerId },
		g => g
	);
	if (guildsCreated.length > 0) {
		csvFiles["logs/60_guilds_created.csv"] = toCSV(guildsCreated.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 61-63. Membership events
	await exportGuildMembershipEvents(logsPlayerId, anonymizer, csvFiles);

	// 64-66. Role changes
	await exportGuildRoleChanges(logsPlayerId, anonymizer, csvFiles);

	// 67. Guild descriptions
	await exportGuildDescriptions(logsPlayerId, anonymizer, csvFiles);

	// 74. Guild names (for guilds created by this player)
	const createdGuildIds = guildsCreated.map(g => g.guildId);
	if (createdGuildIds.length > 0) {
		const guildNames = await LogsGuilds.findAll({ where: { id: { [Op.in]: createdGuildIds } } });
		if (guildNames.length > 0) {
			csvFiles["logs/74_guild_names_created.csv"] = toCSV(guildNames.map(g => ({
				guildId: anonymizer.anonymizeGuildId(g.id),
				name: g.name,
				creationTimestamp: g.creationTimestamp
			})));
		}
	}

	return { guildsCreated };
}
