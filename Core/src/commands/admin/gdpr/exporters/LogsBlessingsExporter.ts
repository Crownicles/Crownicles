import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV
} from "../CSVUtils";
import { LogsBlessings } from "../../../../core/database/logs/models/LogsBlessings";
import { LogsBlessingsContributions } from "../../../../core/database/logs/models/LogsBlessingsContributions";

/**
 * Exports blessing events triggered by the player (files 75)
 */
async function exportBlessingsTriggered(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const blessingsTriggeredCsv = await streamToCSV(
		LogsBlessings,
		{ triggeredByPlayerId: logsPlayerId },
		b => ({
			blessingType: b.blessingType,
			action: b.action,
			triggeredByPlayerId: anonymizer.anonymizePlayerId(b.triggeredByPlayerId, true),
			poolThreshold: b.poolThreshold,
			durationHours: b.durationHours,
			date: b.date
		})
	);
	if (blessingsTriggeredCsv) {
		csvFiles["logs/76_blessings_triggered.csv"] = blessingsTriggeredCsv;
	}
}

/**
 * Exports player contributions to blessing pools (files 76)
 */
async function exportBlessingsContributions(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const contributionsCsv = await streamToCSV(
		LogsBlessingsContributions,
		{ playerId: logsPlayerId },
		c => ({
			amount: c.amount,
			newPoolAmount: c.newPoolAmount,
			date: c.date
		})
	);
	if (contributionsCsv) {
		csvFiles["logs/77_blessings_contributions.csv"] = contributionsCsv;
	}
}

/**
 * Exports blessings data from logs database (files 75-76)
 */
export async function exportLogsBlessings(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 75. Blessings triggered by the player
	await exportBlessingsTriggered(logsPlayerId, anonymizer, csvFiles);

	// 76. Player contributions to blessing pools
	await exportBlessingsContributions(logsPlayerId, csvFiles);
}
