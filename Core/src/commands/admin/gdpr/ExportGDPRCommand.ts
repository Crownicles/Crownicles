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
import { PacketUtils } from "../../../core/utils/PacketUtils";
import { GDPRExportCompleteNotificationPacket } from "../../../../../Lib/src/packets/notifications/GDPRExportCompleteNotificationPacket";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Parameters for GDPR export notification
 */
interface GDPRNotificationParams {
	requesterKeycloakId: string;
	exportedPlayerKeycloakId: string;
	csvFiles: GDPRCsvFiles;
	anonymizedPlayerId: string;
	error?: string;
}

/**
 * A command that exports all GDPR-relevant player data
 * Data is anonymized: own player gets consistent hash, other players are redacted
 *
 * This command implements GDPR Article 15 - Right of access
 *
 * The export runs in background to avoid blocking the main thread.
 * The result is sent as a DM to the admin who requested the export.
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
				started: false,
				error: "Player not found"
			}));
			return;
		}

		// Respond immediately that export has started
		response.push(makePacket(CommandExportGDPRRes, {
			started: true
		}));

		// Run export in background (don't await)
		ExportGDPRCommand.runExportInBackground(packet.keycloakId, packet.requesterKeycloakId)
			.catch(error => {
				CrowniclesLogger.errorWithObj("GDPR export background job failed", error);
			});
	}

	/**
	 * Run the GDPR export in background
	 * This method processes data with small delays between operations to avoid blocking
	 */
	private static async runExportInBackground(playerKeycloakId: string, requesterKeycloakId: string): Promise<void> {
		const player = await Players.getByKeycloakId(playerKeycloakId);

		if (!player) {
			// Should not happen since we checked before, but handle it anyway
			ExportGDPRCommand.sendNotification({
				requesterKeycloakId,
				exportedPlayerKeycloakId: playerKeycloakId,
				csvFiles: {},
				anonymizedPlayerId: "",
				error: "Player not found"
			});
			return;
		}

		const anonymizer = new GDPRAnonymizer(player.id, player.keycloakId);
		const csvFiles: GDPRCsvFiles = {};

		try {
			CrowniclesLogger.info(`Starting GDPR export for player ${anonymizer.getAnonymizedPlayerId()}`);

			// Export player core data (files 01-14)
			await exportPlayerData(player, anonymizer, csvFiles);
			await ExportGDPRCommand.yieldToEventLoop();

			// Export logs database data if player exists in logs
			const logsPlayer = await LogsPlayers.findOne({ where: { keycloakId: player.keycloakId } });

			if (logsPlayer) {
				const logsPlayerId = logsPlayer.id;

				// Export player stats history (files 15-34)
				await exportLogsPlayerStats(logsPlayerId, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();

				// Export missions and achievements (files 35-44)
				const { newPets } = await exportLogsMissions(logsPlayerId, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();

				// Export fights data (files 45-48)
				await exportLogsFights(logsPlayerId, anonymizer, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();

				// Export shop and items data (files 49-59)
				await exportLogsShop(logsPlayerId, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();

				// Export guild data (files 60-67, 74)
				await exportLogsGuild(logsPlayerId, anonymizer, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();

				// Export pets and expeditions data (files 68-73)
				await exportLogsPets(logsPlayerId, anonymizer, newPets, csvFiles);
				await ExportGDPRCommand.yieldToEventLoop();
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

			CrowniclesLogger.info(`GDPR export complete for player ${anonymizer.getAnonymizedPlayerId()}, ${fileCount} files generated`);

			// Send notification with the result
			ExportGDPRCommand.sendNotification({
				requesterKeycloakId,
				exportedPlayerKeycloakId: playerKeycloakId,
				csvFiles,
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId()
			});
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`GDPR export failed for player ${anonymizer.getAnonymizedPlayerId()}`, error);
			ExportGDPRCommand.sendNotification({
				requesterKeycloakId,
				exportedPlayerKeycloakId: playerKeycloakId,
				csvFiles: {},
				anonymizedPlayerId: anonymizer.getAnonymizedPlayerId(),
				error: error instanceof Error ? error.message : "Unknown error during export"
			});
		}
	}

	/**
	 * Small delay to yield control back to the event loop
	 * This prevents blocking the main thread during heavy export operations
	 */
	private static yieldToEventLoop(): Promise<void> {
		return new Promise(resolve => setImmediate(resolve));
	}

	/**
	 * Send the GDPR export result as a notification
	 */
	private static sendNotification(params: GDPRNotificationParams): void {
		PacketUtils.sendNotifications([
			makePacket(GDPRExportCompleteNotificationPacket, {
				keycloakId: params.requesterKeycloakId,
				exportedPlayerKeycloakId: params.exportedPlayerKeycloakId,
				csvFiles: params.csvFiles,
				anonymizedPlayerId: params.anonymizedPlayerId,
				error: params.error
			})
		]);
	}
}
