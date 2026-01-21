import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
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
 * Exports guild-related data from logs database (files 60-67, 74)
 */
export async function exportLogsGuild(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<LogsGuildExportResult> {
	// 60. Guilds created
	const guildsCreated = await LogsGuildsCreations.findAll({ where: { creatorId: logsPlayerId } });
	if (guildsCreated.length > 0) {
		csvFiles["logs/60_guilds_created.csv"] = toCSV(guildsCreated.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 61. Guilds joined (as the one being added)
	const guildsJoined = await LogsGuildsJoins.findAll({ where: { addedId: logsPlayerId } });
	if (guildsJoined.length > 0) {
		csvFiles["logs/61_guilds_joined.csv"] = toCSV(guildsJoined.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId),
			addedBy: anonymizer.anonymizePlayerId(g.adderId, false),
			date: g.date
		})));
	}

	// 62. Guilds kicked from
	const guildsKicked = await LogsGuildsKicks.findAll({ where: { kickedPlayer: logsPlayerId } });
	if (guildsKicked.length > 0) {
		csvFiles["logs/62_guilds_kicked.csv"] = toCSV(guildsKicked.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 63. Guilds left
	const guildsLeft = await LogsGuildsLeaves.findAll({ where: { leftPlayer: logsPlayerId } });
	if (guildsLeft.length > 0) {
		csvFiles["logs/63_guilds_left.csv"] = toCSV(guildsLeft.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 64. Became guild chief
	const becameChief = await LogsGuildsChiefsChanges.findAll({ where: { newChief: logsPlayerId } });
	if (becameChief.length > 0) {
		csvFiles["logs/64_became_guild_chief.csv"] = toCSV(becameChief.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 65. Became guild elder
	const becameElder = await LogsGuildsEldersAdds.findAll({ where: { addedElder: logsPlayerId } });
	if (becameElder.length > 0) {
		csvFiles["logs/65_became_guild_elder.csv"] = toCSV(becameElder.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 66. Removed from guild elder
	const removedElder = await LogsGuildsEldersRemoves.findAll({ where: { removedElder: logsPlayerId } });
	if (removedElder.length > 0) {
		csvFiles["logs/66_removed_guild_elder.csv"] = toCSV(removedElder.map(g => ({
			guildId: anonymizer.anonymizeGuildId(g.guildId), date: g.date
		})));
	}

	// 67. Guild descriptions written by this player
	const descriptionsWritten = await LogsGuildsDescriptionChanges.findAll({ where: { playerId: logsPlayerId } });
	if (descriptionsWritten.length > 0) {
		csvFiles["logs/67_guild_descriptions_written.csv"] = toCSV(descriptionsWritten.map(d => ({
			guildId: anonymizer.anonymizeGuildId(d.guildId),
			description: d.description,
			date: d.date
		})));
	}

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
