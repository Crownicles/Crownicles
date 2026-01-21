import {
	streamToCSV, fetchWithPagination, GDPRCsvFiles
} from "../CSVUtils";
import { LogsPlayersNewPets } from "../../../../core/database/logs/models/LogsPlayersNewPets";
import { LogsPlayersCommands } from "../../../../core/database/logs/models/LogsPlayersCommands";
import { LogsPlayers15BestSeason } from "../../../../core/database/logs/models/LogsPlayers15BestSeason";
import { LogsPlayers15BestTopweek } from "../../../../core/database/logs/models/LogsPlayers15BestTopweek";
import { LogsPlayerLeagueReward } from "../../../../core/database/logs/models/LogsPlayerLeagueReward";
import { LogsMissionsFound } from "../../../../core/database/logs/models/LogsMissionsFound";
import { LogsMissionsFinished } from "../../../../core/database/logs/models/LogsMissionsFinished";
import { LogsMissionsFailed } from "../../../../core/database/logs/models/LogsMissionsFailed";
import { LogsMissionsDailyFinished } from "../../../../core/database/logs/models/LogsMissionsDailyFinished";
import { LogsMissionsCampaignProgresses } from "../../../../core/database/logs/models/LogsMissionsCampaignProgresses";

/**
 * Result containing new pets data for use by other exporters
 */
export interface LogsMissionsExportResult {
	newPets: LogsPlayersNewPets[];
}

/**
 * Exports missions and achievements data from logs database (files 35-44)
 */
export async function exportLogsMissions(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<LogsMissionsExportResult> {
	// 35. New pets obtained
	const newPets = await fetchWithPagination(
		LogsPlayersNewPets,
		{ playerId: logsPlayerId },
		p => p
	);
	const petsCsv = await streamToCSV(
		LogsPlayersNewPets,
		{ playerId: logsPlayerId },
		p => ({
			petId: p.petId, date: p.date
		})
	);
	if (petsCsv) {
		csvFiles["logs/35_pets_obtained.csv"] = petsCsv;
	}

	// 36. Commands used (anonymized - only command name, not content)
	const commandsCsv = await streamToCSV(
		LogsPlayersCommands,
		{ playerId: logsPlayerId },
		c => ({
			commandId: c.commandId, date: c.date
		})
	);
	if (commandsCsv) {
		csvFiles["logs/36_commands_used.csv"] = commandsCsv;
	}

	// 37. Top 15 best season appearances
	const best15SeasonCsv = await streamToCSV(
		LogsPlayers15BestSeason,
		{ playerId: logsPlayerId },
		b => ({
			position: b.position, seasonGlory: b.seasonGlory, date: b.date
		})
	);
	if (best15SeasonCsv) {
		csvFiles["logs/37_top15_season.csv"] = best15SeasonCsv;
	}

	// 38. Top 15 best topweek appearances
	const best15TopweekCsv = await streamToCSV(
		LogsPlayers15BestTopweek,
		{ playerId: logsPlayerId },
		b => ({
			position: b.position, topWeekScore: b.topWeekScore, date: b.date
		})
	);
	if (best15TopweekCsv) {
		csvFiles["logs/38_top15_topweek.csv"] = best15TopweekCsv;
	}

	// 39. League rewards
	const leagueRewardsCsv = await streamToCSV(
		LogsPlayerLeagueReward,
		{ playerId: logsPlayerId },
		l => ({
			leagueLastSeason: l.leagueLastSeason, date: l.date
		})
	);
	if (leagueRewardsCsv) {
		csvFiles["logs/39_league_rewards.csv"] = leagueRewardsCsv;
	}

	// 40. Missions found
	const missionsFoundCsv = await streamToCSV(
		LogsMissionsFound,
		{ playerId: logsPlayerId },
		m => ({
			missionId: m.missionId, date: m.date
		})
	);
	if (missionsFoundCsv) {
		csvFiles["logs/40_missions_found.csv"] = missionsFoundCsv;
	}

	// 41. Missions finished
	const missionsFinishedCsv = await streamToCSV(
		LogsMissionsFinished,
		{ playerId: logsPlayerId },
		m => ({
			missionId: m.missionId, date: m.date
		})
	);
	if (missionsFinishedCsv) {
		csvFiles["logs/41_missions_finished.csv"] = missionsFinishedCsv;
	}

	// 42. Missions failed
	const missionsFailedCsv = await streamToCSV(
		LogsMissionsFailed,
		{ playerId: logsPlayerId },
		m => ({
			missionId: m.missionId, date: m.date
		})
	);
	if (missionsFailedCsv) {
		csvFiles["logs/42_missions_failed.csv"] = missionsFailedCsv;
	}

	// 43. Daily missions finished
	const missionsDailyFinishedCsv = await streamToCSV(
		LogsMissionsDailyFinished,
		{ playerId: logsPlayerId },
		m => ({ date: m.date })
	);
	if (missionsDailyFinishedCsv) {
		csvFiles["logs/43_daily_missions_finished.csv"] = missionsDailyFinishedCsv;
	}

	// 44. Campaign progresses
	const campaignProgressesCsv = await streamToCSV(
		LogsMissionsCampaignProgresses,
		{ playerId: logsPlayerId },
		c => ({
			number: c.number, date: c.date
		})
	);
	if (campaignProgressesCsv) {
		csvFiles["logs/44_campaign_progresses.csv"] = campaignProgressesCsv;
	}

	return { newPets };
}
