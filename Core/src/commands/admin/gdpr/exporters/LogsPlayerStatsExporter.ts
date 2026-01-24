import {
	streamToCSV, GDPRCsvFiles
} from "../CSVUtils";
import { WhereOptions } from "sequelize";
import { LogsPlayersScore } from "../../../../core/database/logs/models/LogsPlayersScore";
import { LogsPlayersLevel } from "../../../../core/database/logs/models/LogsPlayersLevel";
import { LogsPlayersExperience } from "../../../../core/database/logs/models/LogsPlayersExperience";
import { LogsPlayersMoney } from "../../../../core/database/logs/models/LogsPlayersMoney";
import { LogsPlayersHealth } from "../../../../core/database/logs/models/LogsPlayersHealth";
import { LogsPlayersEnergy } from "../../../../core/database/logs/models/LogsPlayersEnergy";
import { LogsPlayersGems } from "../../../../core/database/logs/models/LogsPlayersGems";
import { LogsPlayersRage } from "../../../../core/database/logs/models/LogsPlayersRage";
import { LogsPlayersTokens } from "../../../../core/database/logs/models/LogsPlayersTokens";
import { LogsPlayersGloryPoints } from "../../../../core/database/logs/models/LogsPlayersGloryPoints";
import { LogsPlayersClassChanges } from "../../../../core/database/logs/models/LogsPlayersClassChanges";
import { LogsPlayersTravels } from "../../../../core/database/logs/models/LogsPlayersTravels";
import { LogsPlayersTeleportations } from "../../../../core/database/logs/models/LogsPlayersTeleportations";
import { LogsPlayersTimewarps } from "../../../../core/database/logs/models/LogsPlayersTimewarps";
import { LogsPlayersPossibilities } from "../../../../core/database/logs/models/LogsPlayersPossibilities";
import { LogsPlayersSmallEvents } from "../../../../core/database/logs/models/LogsPlayersSmallEvents";
import { LogsPlayersStandardAlterations } from "../../../../core/database/logs/models/LogsPlayersStandardAlterations";
import { LogsPlayersOccupiedAlterations } from "../../../../core/database/logs/models/LogsPlayersOccupiedAlterations";
import { LogsPlayersVotes } from "../../../../core/database/logs/models/LogsPlayersVotes";
import { LogsPlayersDailies } from "../../../../core/database/logs/models/LogsPlayersDailies";

/**
 * Creates a where clause for player ID lookup
 */
function playerIdWhere(logsPlayerId: number): WhereOptions {
	return { playerId: logsPlayerId };
}

/**
 * Helper to export a stat with value and reason
 */
async function exportStatWithReason<T extends {
	value: number; reason: string; date: number;
}>(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	model: any,
	logsPlayerId: number,
	fileName: string,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		model,
		playerIdWhere(logsPlayerId),
		(s: T) => ({
			value: s.value, reason: s.reason, date: s.date
		})
	);
	if (csv) {
		csvFiles[fileName] = csv;
	}
}

/**
 * Exports core player stats (score, level, experience, money, health, energy)
 */
async function exportCoreStats(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	await exportStatWithReason(LogsPlayersScore, logsPlayerId, "logs/15_score_history.csv", csvFiles);

	const levelCsv = await streamToCSV(
		LogsPlayersLevel,
		playerIdWhere(logsPlayerId),
		l => ({
			level: l.level, date: l.date
		})
	);
	if (levelCsv) {
		csvFiles["logs/16_level_history.csv"] = levelCsv;
	}

	await exportStatWithReason(LogsPlayersExperience, logsPlayerId, "logs/17_experience_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersMoney, logsPlayerId, "logs/18_money_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersHealth, logsPlayerId, "logs/19_health_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersEnergy, logsPlayerId, "logs/20_energy_history.csv", csvFiles);
}

/**
 * Exports currency stats (gems, rage, tokens, glory points)
 */
async function exportCurrencyStats(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	await exportStatWithReason(LogsPlayersGems, logsPlayerId, "logs/21_gems_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersRage, logsPlayerId, "logs/22_rage_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersTokens, logsPlayerId, "logs/23_tokens_history.csv", csvFiles);
	await exportStatWithReason(LogsPlayersGloryPoints, logsPlayerId, "logs/24_glory_points_history.csv", csvFiles);
}

/**
 * Exports movement and class changes
 */
async function exportMovementStats(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const classChangesCsv = await streamToCSV(
		LogsPlayersClassChanges,
		playerIdWhere(logsPlayerId),
		c => ({
			classId: c.classId, date: c.date
		})
	);
	if (classChangesCsv) {
		csvFiles["logs/25_class_changes.csv"] = classChangesCsv;
	}

	const travelsCsv = await streamToCSV(
		LogsPlayersTravels,
		playerIdWhere(logsPlayerId),
		t => ({
			mapLinkId: t.mapLinkId, date: t.date
		})
	);
	if (travelsCsv) {
		csvFiles["logs/26_travels.csv"] = travelsCsv;
	}

	const teleportationsCsv = await streamToCSV(
		LogsPlayersTeleportations,
		playerIdWhere(logsPlayerId),
		t => ({
			originMapLinkId: t.originMapLinkId, newMapLinkId: t.newMapLinkId, date: t.date
		})
	);
	if (teleportationsCsv) {
		csvFiles["logs/27_teleportations.csv"] = teleportationsCsv;
	}

	const timewarpsCsv = await streamToCSV(
		LogsPlayersTimewarps,
		playerIdWhere(logsPlayerId),
		t => ({
			time: t.time, reason: t.reason, date: t.date
		})
	);
	if (timewarpsCsv) {
		csvFiles["logs/28_timewarps.csv"] = timewarpsCsv;
	}
}

/**
 * Exports events and alterations
 */
async function exportEventsAndAlterations(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const possibilitiesCsv = await streamToCSV(
		LogsPlayersPossibilities,
		playerIdWhere(logsPlayerId),
		p => ({
			possibilityId: p.possibilityId, date: p.date
		})
	);
	if (possibilitiesCsv) {
		csvFiles["logs/29_event_possibilities.csv"] = possibilitiesCsv;
	}

	const smallEventsCsv = await streamToCSV(
		LogsPlayersSmallEvents,
		playerIdWhere(logsPlayerId),
		s => ({
			smallEventId: s.smallEventId, date: s.date
		})
	);
	if (smallEventsCsv) {
		csvFiles["logs/30_small_events.csv"] = smallEventsCsv;
	}

	const standardAlterationsCsv = await streamToCSV(
		LogsPlayersStandardAlterations,
		playerIdWhere(logsPlayerId),
		a => ({
			alterationId: a.alterationId, reason: a.reason, date: a.date
		})
	);
	if (standardAlterationsCsv) {
		csvFiles["logs/31_standard_alterations.csv"] = standardAlterationsCsv;
	}

	const occupiedAlterationsCsv = await streamToCSV(
		LogsPlayersOccupiedAlterations,
		playerIdWhere(logsPlayerId),
		a => ({
			duration: a.duration, reason: a.reason, date: a.date
		})
	);
	if (occupiedAlterationsCsv) {
		csvFiles["logs/32_occupied_alterations.csv"] = occupiedAlterationsCsv;
	}
}

/**
 * Exports daily activities (votes, dailies)
 */
async function exportDailyActivities(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const votesCsv = await streamToCSV(
		LogsPlayersVotes,
		playerIdWhere(logsPlayerId),
		v => ({ date: v.date })
	);
	if (votesCsv) {
		csvFiles["logs/33_votes.csv"] = votesCsv;
	}

	const dailiesCsv = await streamToCSV(
		LogsPlayersDailies,
		playerIdWhere(logsPlayerId),
		d => ({
			itemId: d.itemId, date: d.getDataValue("date" as keyof typeof d)
		})
	);
	if (dailiesCsv) {
		csvFiles["logs/34_dailies.csv"] = dailiesCsv;
	}
}

/**
 * Exports player stats history from logs database (files 15-34)
 */
export async function exportLogsPlayerStats(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 15-20. Core stats (score, level, experience, money, health, energy)
	await exportCoreStats(logsPlayerId, csvFiles);

	// 21-24. Currency stats (gems, rage, tokens, glory points)
	await exportCurrencyStats(logsPlayerId, csvFiles);

	// 25-28. Movement and class changes
	await exportMovementStats(logsPlayerId, csvFiles);

	// 29-32. Events and alterations
	await exportEventsAndAlterations(logsPlayerId, csvFiles);

	// 33-34. Daily activities
	await exportDailyActivities(logsPlayerId, csvFiles);
}
