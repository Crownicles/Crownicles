import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
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
	// 68. Pets sold
	const petsSold = await LogsPetsSells.findAll({ where: { sellerId: logsPlayerId } });
	if (petsSold.length > 0) {
		csvFiles["logs/68_pets_sold.csv"] = toCSV(petsSold.map(p => ({
			petId: p.petId,
			buyerId: anonymizer.anonymizePlayerId(p.buyerId, false),
			price: p.price,
			date: p.date
		})));
	}

	// 69. Pets bought
	const petsBought = await LogsPetsSells.findAll({ where: { buyerId: logsPlayerId } });
	if (petsBought.length > 0) {
		csvFiles["logs/69_pets_bought.csv"] = toCSV(petsBought.map(p => ({
			petId: p.petId,
			sellerId: anonymizer.anonymizePlayerId(p.sellerId, false),
			price: p.price,
			date: p.date
		})));
	}

	// 70. Expeditions
	const expeditions = await LogsExpeditions.findAll({ where: { playerId: logsPlayerId } });
	if (expeditions.length > 0) {
		csvFiles["logs/70_expeditions.csv"] = toCSV(expeditions.map(e => ({
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
		})));
	}

	// 71. Unlocks (bought freedom)
	const unlocksBuyer = await LogsUnlocks.findAll({ where: { buyerId: logsPlayerId } });
	if (unlocksBuyer.length > 0) {
		csvFiles["logs/71_unlocks_bought.csv"] = toCSV(unlocksBuyer.map(u => ({
			freedPlayerId: anonymizer.anonymizePlayerId(u.releasedId, false),
			date: u.date
		})));
	}

	// 72. Unlocks (was freed by someone)
	const unlocksFreed = await LogsUnlocks.findAll({ where: { releasedId: logsPlayerId } });
	if (unlocksFreed.length > 0) {
		csvFiles["logs/72_unlocks_received.csv"] = toCSV(unlocksFreed.map(u => ({
			buyerId: anonymizer.anonymizePlayerId(u.buyerId, false),
			date: u.date
		})));
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
