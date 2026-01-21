import { adminCommand } from "../../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../../../core/database/game/models/Player";
import {
	CommandExportGDPRReq,
	CommandExportGDPRRes
} from "../../../../../Lib/src/packets/commands/CommandExportGDPRPacket";
import { RightGroup } from "../../../../../Lib/src/types/RightGroup";
import { LogsPlayers } from "../../../core/database/logs/models/LogsPlayers";
import { GDPRAnonymizer } from "./GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
} from "./CSVUtils";
import { exportPlayerData } from "./exporters/PlayerDataExporter";
import { exportLogsPlayerStats } from "./exporters/LogsPlayerStatsExporter";
import { exportLogsMissions } from "./exporters/LogsMissionsExporter";
import { exportLogsFights } from "./exporters/LogsFightsExporter";
import { exportLogsShop } from "./exporters/LogsShopExporter";
import { exportLogsGuild } from "./exporters/LogsGuildExporter";
import { exportLogsPets } from "./exporters/LogsPetsExporter";

/**
 * A command that exports all GDPR-relevant player data
 * Data is anonymized: own player gets consistent hash, other players are redacted
 *
 * This command implements GDPR Article 15 - Right of access
 */
export default class ExportGDPRCommand {
	static verifyRights(context: PacketContext): boolean {
		return context.rightGroups?.includes(RightGroup.ADMIN) ?? false;
	}

	@adminCommand(CommandExportGDPRReq, ExportGDPRCommand.verifyRights)
	async execute(response: CrowniclesPacket[], packet: CommandExportGDPRReq): Promise<void> {
		const player = await Players.getByKeycloakId(packet.keycloakId);

		if (!player) {
			response.push(makePacket(CommandExportGDPRRes, {
				exists: false,
				csvFiles: {},
				anonymizedPlayerId: ""
			}));
			return;
		}

		const anonymizer = new GDPRAnonymizer(player.id, player.keycloakId);
		const csvFiles: GDPRCsvFiles = {};

		try {
			// Export player core data (files 01-14)
			await exportPlayerData(player, anonymizer, csvFiles);

			// Export logs database data if player exists in logs
			const logsPlayer = await LogsPlayers.findOne({ where: { keycloakId: player.keycloakId } });

			if (logsPlayer) {
				const logsPlayerId = logsPlayer.id;

				// Export player stats history (files 15-34)
				await exportLogsPlayerStats(logsPlayerId, csvFiles);

				// Export missions and achievements (files 35-44)
				const { newPets } = await exportLogsMissions(logsPlayerId, csvFiles);

				// Export fights data (files 45-48)
				await exportLogsFights(logsPlayerId, anonymizer, csvFiles);

				// Export shop and items data (files 49-59)
				await exportLogsShop(logsPlayerId, csvFiles);

				// Export guild data (files 60-67, 74)
				await exportLogsGuild(logsPlayerId, anonymizer, csvFiles);

				// Export pets and expeditions data (files 68-73)
				await exportLogsPets(logsPlayerId, anonymizer, newPets, csvFiles);
			}

			// Add metadata file - calculate count before adding metadata
			const fileCount = Object.keys(csvFiles).length + 1; // +1 for metadata itself
			csvFiles["00_metadata.csv"] = toCSV([
				{
					exportDate: new Date().toISOString(),
					anonymizedPlayerId: anonymizer.getAnonymizedPlayerId(),
					gdprArticle: "Art. 15 GDPR - Right of access",
					dataRetentionNote: "This export contains all personal data processed about you. IDs referencing other players have been anonymized.",
					fileCount
				}
			]);

			response.push(makePacket(CommandExportGDPRRes, {
				exists: true,
				csvFiles,
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId()
			}));
		}
		catch (error) {
			response.push(makePacket(CommandExportGDPRRes, {
				exists: true,
				error: error instanceof Error ? error.message : "Unknown error during export",
				csvFiles: {},
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId()
			}));
		}
	}
}
