import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV, toCSV
} from "../CSVUtils";
import { LogsPetsSells } from "../../../../core/database/logs/models/LogsPetsSells";
import { LogsExpeditions } from "../../../../core/database/logs/models/LogsExpeditions";
import { LogsUnlocks } from "../../../../core/database/logs/models/LogsUnlocks";
import { LogsPetsNicknames } from "../../../../core/database/logs/models/LogsPetsNicknames";
import { LogsPlayersNewPets } from "../../../../core/database/logs/models/LogsPlayersNewPets";
import { Op } from "sequelize";

/**
 * Exports pets and expeditions data from logs database (files 68-73)
 */
export async function exportLogsPets(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	newPets: LogsPlayersNewPets[],
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 68. Pets sold - use streamToCSV
	const petsSoldCsv = await streamToCSV(
		LogsPetsSells,
		{ sellerId: logsPlayerId },
		p => ({
			petId: p.petId,
			buyerId: anonymizer.anonymizePlayerId(p.buyerId, false),
			price: p.price,
			date: p.date
		})
	);
	if (petsSoldCsv) {
		csvFiles["logs/68_pets_sold.csv"] = petsSoldCsv;
	}

	// 69. Pets bought - use streamToCSV
	const petsBoughtCsv = await streamToCSV(
		LogsPetsSells,
		{ buyerId: logsPlayerId },
		p => ({
			petId: p.petId,
			sellerId: anonymizer.anonymizePlayerId(p.sellerId, false),
			price: p.price,
			date: p.date
		})
	);
	if (petsBoughtCsv) {
		csvFiles["logs/69_pets_bought.csv"] = petsBoughtCsv;
	}

	// 70. Expeditions - use streamToCSV
	const expeditionsCsv = await streamToCSV(
		LogsExpeditions,
		{ playerId: logsPlayerId },
		e => ({
			petId: e.petId,
			mapLocationId: e.mapLocationId,
			locationType: e.locationType,
			action: e.action,
			durationMinutes: e.durationMinutes,
			foodConsumed: e.foodConsumed,
			success: e.success,
			money: e.money,
			experience: e.experience,
			points: e.points,
			tokens: e.tokens,
			loveChange: e.loveChange,
			date: e.date
		})
	);
	if (expeditionsCsv) {
		csvFiles["logs/70_expeditions.csv"] = expeditionsCsv;
	}

	// 71. Unlocks (bought freedom) - use streamToCSV
	const unlocksBuyerCsv = await streamToCSV(
		LogsUnlocks,
		{ buyerId: logsPlayerId },
		u => ({
			freedPlayerId: anonymizer.anonymizePlayerId(u.releasedId, false),
			date: u.date
		})
	);
	if (unlocksBuyerCsv) {
		csvFiles["logs/71_unlocks_bought.csv"] = unlocksBuyerCsv;
	}

	// 72. Unlocks (was freed by someone) - use streamToCSV
	const unlocksFreedCsv = await streamToCSV(
		LogsUnlocks,
		{ releasedId: logsPlayerId },
		u => ({
			buyerId: anonymizer.anonymizePlayerId(u.buyerId, false),
			date: u.date
		})
	);
	if (unlocksFreedCsv) {
		csvFiles["logs/72_unlocks_received.csv"] = unlocksFreedCsv;
	}

	// 73. Pet nicknames (need to find pet entities owned by player first)
	const playerPetIds = newPets.map(p => p.petId);
	if (playerPetIds.length > 0) {
		const petNicknames = await LogsPetsNicknames.findAll({ where: { petId: { [Op.in]: playerPetIds } } });
		if (petNicknames.length > 0) {
			csvFiles["logs/73_pet_nicknames.csv"] = toCSV(petNicknames.map(n => ({
				petId: n.petId, name: n.name, date: n.date
			})));
		}
	}
}
