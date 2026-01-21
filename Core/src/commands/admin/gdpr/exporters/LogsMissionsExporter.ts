import {
	toCSV, GDPRCsvFiles
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
	const newPets = await LogsPlayersNewPets.findAll({ where: { playerId: logsPlayerId } });
	if (newPets.length > 0) {
		csvFiles["logs/35_pets_obtained.csv"] = toCSV(newPets.map(p => ({
			petId: p.petId, date: p.date
		})));
	}

	// 36. Commands used (anonymized - only command name, not content)
	const commands = await LogsPlayersCommands.findAll({ where: { playerId: logsPlayerId } });
	if (commands.length > 0) {
		csvFiles["logs/36_commands_used.csv"] = toCSV(commands.map(c => ({
			commandId: c.commandId, date: c.date
		})));
	}

	// 37. Top 15 best season appearances
	const best15Season = await LogsPlayers15BestSeason.findAll({ where: { playerId: logsPlayerId } });
	if (best15Season.length > 0) {
		csvFiles["logs/37_top15_season.csv"] = toCSV(best15Season.map(b => ({
			position: b.position, seasonGlory: b.seasonGlory, date: b.date
		})));
	}

	// 38. Top 15 best topweek appearances
	const best15Topweek = await LogsPlayers15BestTopweek.findAll({ where: { playerId: logsPlayerId } });
	if (best15Topweek.length > 0) {
		csvFiles["logs/38_top15_topweek.csv"] = toCSV(best15Topweek.map(b => ({
			position: b.position, topWeekScore: b.topWeekScore, date: b.date
		})));
	}

	// 39. League rewards
	const leagueRewards = await LogsPlayerLeagueReward.findAll({ where: { playerId: logsPlayerId } });
	if (leagueRewards.length > 0) {
		csvFiles["logs/39_league_rewards.csv"] = toCSV(leagueRewards.map(l => ({
			leagueLastSeason: l.leagueLastSeason, date: l.date
		})));
	}

	// 40. Missions found
	const missionsFound = await LogsMissionsFound.findAll({ where: { playerId: logsPlayerId } });
	if (missionsFound.length > 0) {
		csvFiles["logs/40_missions_found.csv"] = toCSV(missionsFound.map(m => ({
			missionId: m.missionId, date: m.date
		})));
	}

	// 41. Missions finished
	const missionsFinished = await LogsMissionsFinished.findAll({ where: { playerId: logsPlayerId } });
	if (missionsFinished.length > 0) {
		csvFiles["logs/41_missions_finished.csv"] = toCSV(missionsFinished.map(m => ({
			missionId: m.missionId, date: m.date
		})));
	}

	// 42. Missions failed
	const missionsFailed = await LogsMissionsFailed.findAll({ where: { playerId: logsPlayerId } });
	if (missionsFailed.length > 0) {
		csvFiles["logs/42_missions_failed.csv"] = toCSV(missionsFailed.map(m => ({
			missionId: m.missionId, date: m.date
		})));
	}

	// 43. Daily missions finished
	const missionsDailyFinished = await LogsMissionsDailyFinished.findAll({ where: { playerId: logsPlayerId } });
	if (missionsDailyFinished.length > 0) {
		csvFiles["logs/43_daily_missions_finished.csv"] = toCSV(missionsDailyFinished.map(m => ({
			date: m.date
		})));
	}

	// 44. Campaign progresses
	const campaignProgresses = await LogsMissionsCampaignProgresses.findAll({ where: { playerId: logsPlayerId } });
	if (campaignProgresses.length > 0) {
		csvFiles["logs/44_campaign_progresses.csv"] = toCSV(campaignProgresses.map(c => ({
			number: c.number, date: c.date
		})));
	}

	return { newPets };
}
