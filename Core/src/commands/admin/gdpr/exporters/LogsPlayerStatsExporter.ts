import {
	toCSV, GDPRCsvFiles
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
	const scoreHistory = await LogsPlayersScore.findAll({ where: { playerId: logsPlayerId } });
	if (scoreHistory.length > 0) {
		csvFiles["logs/15_score_history.csv"] = toCSV(scoreHistory.map(s => ({
			value: s.value, reason: s.reason, date: s.date
		})));
	}

	// 16. Level history
	const levelHistory = await LogsPlayersLevel.findAll({ where: { playerId: logsPlayerId } });
	if (levelHistory.length > 0) {
		csvFiles["logs/16_level_history.csv"] = toCSV(levelHistory.map(l => ({
			level: l.level, date: l.date
		})));
	}

	// 17. Experience history
	const expHistory = await LogsPlayersExperience.findAll({ where: { playerId: logsPlayerId } });
	if (expHistory.length > 0) {
		csvFiles["logs/17_experience_history.csv"] = toCSV(expHistory.map(e => ({
			value: e.value, reason: e.reason, date: e.date
		})));
	}

	// 18. Money history
	const moneyHistory = await LogsPlayersMoney.findAll({ where: { playerId: logsPlayerId } });
	if (moneyHistory.length > 0) {
		csvFiles["logs/18_money_history.csv"] = toCSV(moneyHistory.map(m => ({
			value: m.value, reason: m.reason, date: m.date
		})));
	}

	// 19. Health history
	const healthHistory = await LogsPlayersHealth.findAll({ where: { playerId: logsPlayerId } });
	if (healthHistory.length > 0) {
		csvFiles["logs/19_health_history.csv"] = toCSV(healthHistory.map(h => ({
			value: h.value, reason: h.reason, date: h.date
		})));
	}

	// 20. Energy history
	const energyHistory = await LogsPlayersEnergy.findAll({ where: { playerId: logsPlayerId } });
	if (energyHistory.length > 0) {
		csvFiles["logs/20_energy_history.csv"] = toCSV(energyHistory.map(e => ({
			value: e.value, reason: e.reason, date: e.date
		})));
	}

	// 21. Gems history
	const gemsHistory = await LogsPlayersGems.findAll({ where: { playerId: logsPlayerId } });
	if (gemsHistory.length > 0) {
		csvFiles["logs/21_gems_history.csv"] = toCSV(gemsHistory.map(g => ({
			value: g.value, reason: g.reason, date: g.date
		})));
	}

	// 22. Rage history
	const rageHistory = await LogsPlayersRage.findAll({ where: { playerId: logsPlayerId } });
	if (rageHistory.length > 0) {
		csvFiles["logs/22_rage_history.csv"] = toCSV(rageHistory.map(r => ({
			value: r.value, reason: r.reason, date: r.date
		})));
	}

	// 23. Tokens history
	const tokensHistory = await LogsPlayersTokens.findAll({ where: { playerId: logsPlayerId } });
	if (tokensHistory.length > 0) {
		csvFiles["logs/23_tokens_history.csv"] = toCSV(tokensHistory.map(t => ({
			value: t.value, reason: t.reason, date: t.date
		})));
	}

	// 24. Glory points history
	const gloryHistory = await LogsPlayersGloryPoints.findAll({ where: { playerId: logsPlayerId } });
	if (gloryHistory.length > 0) {
		csvFiles["logs/24_glory_points_history.csv"] = toCSV(gloryHistory.map(g => ({
			value: g.value, reason: g.reason, date: g.date
		})));
	}

	// 25. Class changes
	const classChanges = await LogsPlayersClassChanges.findAll({ where: { playerId: logsPlayerId } });
	if (classChanges.length > 0) {
		csvFiles["logs/25_class_changes.csv"] = toCSV(classChanges.map(c => ({
			classId: c.classId, date: c.date
		})));
	}

	// 26. Travels
	const travels = await LogsPlayersTravels.findAll({ where: { playerId: logsPlayerId } });
	if (travels.length > 0) {
		csvFiles["logs/26_travels.csv"] = toCSV(travels.map(t => ({
			mapLinkId: t.mapLinkId, date: t.date
		})));
	}

	// 27. Teleportations
	const teleportations = await LogsPlayersTeleportations.findAll({ where: { playerId: logsPlayerId } });
	if (teleportations.length > 0) {
		csvFiles["logs/27_teleportations.csv"] = toCSV(teleportations.map(t => ({
			originMapLinkId: t.originMapLinkId, newMapLinkId: t.newMapLinkId, date: t.date
		})));
	}

	// 28. Timewarps
	const timewarps = await LogsPlayersTimewarps.findAll({ where: { playerId: logsPlayerId } });
	if (timewarps.length > 0) {
		csvFiles["logs/28_timewarps.csv"] = toCSV(timewarps.map(t => ({
			time: t.time, reason: t.reason, date: t.date
		})));
	}

	// 29. Possibilities (event choices)
	const possibilities = await LogsPlayersPossibilities.findAll({ where: { playerId: logsPlayerId } });
	if (possibilities.length > 0) {
		csvFiles["logs/29_event_possibilities.csv"] = toCSV(possibilities.map(p => ({
			possibilityId: p.possibilityId, date: p.date
		})));
	}

	// 30. Small events seen
	const logsSmallEvents = await LogsPlayersSmallEvents.findAll({ where: { playerId: logsPlayerId } });
	if (logsSmallEvents.length > 0) {
		csvFiles["logs/30_small_events.csv"] = toCSV(logsSmallEvents.map(s => ({
			smallEventId: s.smallEventId, date: s.date
		})));
	}

	// 31. Standard alterations
	const standardAlterations = await LogsPlayersStandardAlterations.findAll({ where: { playerId: logsPlayerId } });
	if (standardAlterations.length > 0) {
		csvFiles["logs/31_standard_alterations.csv"] = toCSV(standardAlterations.map(a => ({
			alterationId: a.alterationId, reason: a.reason, date: a.date
		})));
	}

	// 32. Occupied alterations
	const occupiedAlterations = await LogsPlayersOccupiedAlterations.findAll({ where: { playerId: logsPlayerId } });
	if (occupiedAlterations.length > 0) {
		csvFiles["logs/32_occupied_alterations.csv"] = toCSV(occupiedAlterations.map(a => ({
			duration: a.duration, reason: a.reason, date: a.date
		})));
	}

	// 33. Votes
	const votes = await LogsPlayersVotes.findAll({ where: { playerId: logsPlayerId } });
	if (votes.length > 0) {
		csvFiles["logs/33_votes.csv"] = toCSV(votes.map(v => ({
			date: v.date
		})));
	}

	// 34. Dailies
	const dailies = await LogsPlayersDailies.findAll({ where: { playerId: logsPlayerId } });
	if (dailies.length > 0) {
		csvFiles["logs/34_dailies.csv"] = toCSV(dailies.map(d => ({
			itemId: d.itemId, date: d.getDataValue("date" as keyof typeof d)
		})));
	}
}
