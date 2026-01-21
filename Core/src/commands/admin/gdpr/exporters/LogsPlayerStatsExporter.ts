import {
	streamToCSV, GDPRCsvFiles
} from "../CSVUtils";
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
 * Exports player stats history from logs database (files 15-34)
 */
export async function exportLogsPlayerStats(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 15. Score history
	const scoreHistoryCsv = await streamToCSV(
		LogsPlayersScore,
		{ playerId: logsPlayerId },
		s => ({
			value: s.value, reason: s.reason, date: s.date
		})
	);
	if (scoreHistoryCsv) {
		csvFiles["logs/15_score_history.csv"] = scoreHistoryCsv;
	}

	// 16. Level history
	const levelHistoryCsv = await streamToCSV(
		LogsPlayersLevel,
		{ playerId: logsPlayerId },
		l => ({
			level: l.level, date: l.date
		})
	);
	if (levelHistoryCsv) {
		csvFiles["logs/16_level_history.csv"] = levelHistoryCsv;
	}

	// 17. Experience history
	const expHistoryCsv = await streamToCSV(
		LogsPlayersExperience,
		{ playerId: logsPlayerId },
		e => ({
			value: e.value, reason: e.reason, date: e.date
		})
	);
	if (expHistoryCsv) {
		csvFiles["logs/17_experience_history.csv"] = expHistoryCsv;
	}

	// 18. Money history
	const moneyHistoryCsv = await streamToCSV(
		LogsPlayersMoney,
		{ playerId: logsPlayerId },
		m => ({
			value: m.value, reason: m.reason, date: m.date
		})
	);
	if (moneyHistoryCsv) {
		csvFiles["logs/18_money_history.csv"] = moneyHistoryCsv;
	}

	// 19. Health history
	const healthHistoryCsv = await streamToCSV(
		LogsPlayersHealth,
		{ playerId: logsPlayerId },
		h => ({
			value: h.value, reason: h.reason, date: h.date
		})
	);
	if (healthHistoryCsv) {
		csvFiles["logs/19_health_history.csv"] = healthHistoryCsv;
	}

	// 20. Energy history
	const energyHistoryCsv = await streamToCSV(
		LogsPlayersEnergy,
		{ playerId: logsPlayerId },
		e => ({
			value: e.value, reason: e.reason, date: e.date
		})
	);
	if (energyHistoryCsv) {
		csvFiles["logs/20_energy_history.csv"] = energyHistoryCsv;
	}

	// 21. Gems history
	const gemsHistoryCsv = await streamToCSV(
		LogsPlayersGems,
		{ playerId: logsPlayerId },
		g => ({
			value: g.value, reason: g.reason, date: g.date
		})
	);
	if (gemsHistoryCsv) {
		csvFiles["logs/21_gems_history.csv"] = gemsHistoryCsv;
	}

	// 22. Rage history
	const rageHistoryCsv = await streamToCSV(
		LogsPlayersRage,
		{ playerId: logsPlayerId },
		r => ({
			value: r.value, reason: r.reason, date: r.date
		})
	);
	if (rageHistoryCsv) {
		csvFiles["logs/22_rage_history.csv"] = rageHistoryCsv;
	}

	// 23. Tokens history
	const tokensHistoryCsv = await streamToCSV(
		LogsPlayersTokens,
		{ playerId: logsPlayerId },
		t => ({
			value: t.value, reason: t.reason, date: t.date
		})
	);
	if (tokensHistoryCsv) {
		csvFiles["logs/23_tokens_history.csv"] = tokensHistoryCsv;
	}

	// 24. Glory points history
	const gloryHistoryCsv = await streamToCSV(
		LogsPlayersGloryPoints,
		{ playerId: logsPlayerId },
		g => ({
			value: g.value, reason: g.reason, date: g.date
		})
	);
	if (gloryHistoryCsv) {
		csvFiles["logs/24_glory_points_history.csv"] = gloryHistoryCsv;
	}

	// 25. Class changes
	const classChangesCsv = await streamToCSV(
		LogsPlayersClassChanges,
		{ playerId: logsPlayerId },
		c => ({
			classId: c.classId, date: c.date
		})
	);
	if (classChangesCsv) {
		csvFiles["logs/25_class_changes.csv"] = classChangesCsv;
	}

	// 26. Travels
	const travelsCsv = await streamToCSV(
		LogsPlayersTravels,
		{ playerId: logsPlayerId },
		t => ({
			mapLinkId: t.mapLinkId, date: t.date
		})
	);
	if (travelsCsv) {
		csvFiles["logs/26_travels.csv"] = travelsCsv;
	}

	// 27. Teleportations
	const teleportationsCsv = await streamToCSV(
		LogsPlayersTeleportations,
		{ playerId: logsPlayerId },
		t => ({
			originMapLinkId: t.originMapLinkId, newMapLinkId: t.newMapLinkId, date: t.date
		})
	);
	if (teleportationsCsv) {
		csvFiles["logs/27_teleportations.csv"] = teleportationsCsv;
	}

	// 28. Timewarps
	const timewarpsCsv = await streamToCSV(
		LogsPlayersTimewarps,
		{ playerId: logsPlayerId },
		t => ({
			time: t.time, reason: t.reason, date: t.date
		})
	);
	if (timewarpsCsv) {
		csvFiles["logs/28_timewarps.csv"] = timewarpsCsv;
	}

	// 29. Possibilities (event choices)
	const possibilitiesCsv = await streamToCSV(
		LogsPlayersPossibilities,
		{ playerId: logsPlayerId },
		p => ({
			possibilityId: p.possibilityId, date: p.date
		})
	);
	if (possibilitiesCsv) {
		csvFiles["logs/29_event_possibilities.csv"] = possibilitiesCsv;
	}

	// 30. Small events seen
	const smallEventsCsv = await streamToCSV(
		LogsPlayersSmallEvents,
		{ playerId: logsPlayerId },
		s => ({
			smallEventId: s.smallEventId, date: s.date
		})
	);
	if (smallEventsCsv) {
		csvFiles["logs/30_small_events.csv"] = smallEventsCsv;
	}

	// 31. Standard alterations
	const standardAlterationsCsv = await streamToCSV(
		LogsPlayersStandardAlterations,
		{ playerId: logsPlayerId },
		a => ({
			alterationId: a.alterationId, reason: a.reason, date: a.date
		})
	);
	if (standardAlterationsCsv) {
		csvFiles["logs/31_standard_alterations.csv"] = standardAlterationsCsv;
	}

	// 32. Occupied alterations
	const occupiedAlterationsCsv = await streamToCSV(
		LogsPlayersOccupiedAlterations,
		{ playerId: logsPlayerId },
		a => ({
			duration: a.duration, reason: a.reason, date: a.date
		})
	);
	if (occupiedAlterationsCsv) {
		csvFiles["logs/32_occupied_alterations.csv"] = occupiedAlterationsCsv;
	}

	// 33. Votes
	const votesCsv = await streamToCSV(
		LogsPlayersVotes,
		{ playerId: logsPlayerId },
		v => ({ date: v.date })
	);
	if (votesCsv) {
		csvFiles["logs/33_votes.csv"] = votesCsv;
	}

	// 34. Dailies
	const dailiesCsv = await streamToCSV(
		LogsPlayersDailies,
		{ playerId: logsPlayerId },
		d => ({
			itemId: d.itemId, date: d.getDataValue("date" as keyof typeof d)
		})
	);
	if (dailiesCsv) {
		csvFiles["logs/34_dailies.csv"] = dailiesCsv;
	}
}
