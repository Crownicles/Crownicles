import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV
} from "../CSVUtils";
import { LogsPetsSells } from "../../../../core/database/logs/models/LogsPetsSells";
import { LogsExpeditions } from "../../../../core/database/logs/models/LogsExpeditions";
import { LogsUnlocks } from "../../../../core/database/logs/models/LogsUnlocks";
import { LogsPetsNicknames } from "../../../../core/database/logs/models/LogsPetsNicknames";
import { LogsPetsFrees } from "../../../../core/database/logs/models/LogsPetsFrees";
import { LogsPetsLovesChanges } from "../../../../core/database/logs/models/LogsPetsLovesChanges";
import { LogsPetsTransfers } from "../../../../core/database/logs/models/LogsPetsTransfers";

/**
 * Exports pet trade transactions (sold and bought)
 */
async function exportPetTrades(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
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
}

/**
 * Exports player unlock transactions (freedom bought/received)
 */
async function exportUnlockTransactions(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
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
}

async function exportPetHistory(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const playerIdWhere = { playerId: logsPlayerId };
	const nicknamesCsv = await streamToCSV(
		LogsPetsNicknames,
		playerIdWhere,
		nickname => ({
			petId: nickname.petId,
			name: nickname.name,
			date: nickname.date
		})
	);
	if (nicknamesCsv) {
		csvFiles["logs/73_pet_nicknames.csv"] = nicknamesCsv;
	}

	const freesCsv = await streamToCSV(
		LogsPetsFrees,
		playerIdWhere,
		petFree => ({
			petId: petFree.petId,
			date: petFree.date
		})
	);
	if (freesCsv) {
		csvFiles["logs/96_pets_freed.csv"] = freesCsv;
	}

	const loveChangesCsv = await streamToCSV(
		LogsPetsLovesChanges,
		playerIdWhere,
		change => ({
			petId: change.petId,
			lovePoints: change.lovePoints,
			reason: change.reason,
			date: change.date
		})
	);
	if (loveChangesCsv) {
		csvFiles["logs/97_pet_love_changes.csv"] = loveChangesCsv;
	}

	const transfersCsv = await streamToCSV(
		LogsPetsTransfers,
		playerIdWhere,
		transfer => ({
			playerPetId: transfer.playerPetId,
			guildPetId: transfer.guildPetId,
			date: transfer.date
		})
	);
	if (transfersCsv) {
		csvFiles["logs/98_pet_transfers.csv"] = transfersCsv;
	}
}

/**
 * Exports pets and expeditions data from logs database (files 68-73)
 */
export async function exportLogsPets(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 68-69. Pet trades
	await exportPetTrades(logsPlayerId, anonymizer, csvFiles);

	// 70. Expeditions
	const expeditionsCsv = await streamToCSV(
		LogsExpeditions,
		{ playerId: logsPlayerId },
		e => ({
			petId: e.petId,
			mapLocationId: e.mapLocationId,
			locationType: e.locationType,
			action: e.action,
			durationMinutes: e.durationMinutes,
			rewardIndex: e.rewardIndex,
			foodConsumed: e.foodConsumed,
			success: e.success,
			money: e.money,
			experience: e.experience,
			points: e.points,
			tokens: e.tokens,
			cloneTalismanFound: e.cloneTalismanFound,
			loveChange: e.loveChange,
			date: e.date
		})
	);
	if (expeditionsCsv) {
		csvFiles["logs/70_expeditions.csv"] = expeditionsCsv;
	}

	// 71-72. Unlock transactions
	await exportUnlockTransactions(logsPlayerId, anonymizer, csvFiles);

	// 73, 96-98. History directly attributed to the acting player
	await exportPetHistory(logsPlayerId, csvFiles);
}
