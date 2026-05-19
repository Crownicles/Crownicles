import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV
} from "../CSVUtils";
import { LogsInnMeals } from "../../../../core/database/logs/models/LogsInnMeals";
import { LogsInnRooms } from "../../../../core/database/logs/models/LogsInnRooms";

/**
 * Exports inn meal purchases by the player (file 78)
 */
async function exportInnMeals(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const innMealsCsv = await streamToCSV(
		LogsInnMeals,
		{ playerId: logsPlayerId },
		m => ({
			cityId: m.cityId,
			innId: m.innId,
			mealId: m.mealId,
			price: m.price,
			energyGained: m.energyGained,
			energyBefore: m.energyBefore,
			date: m.date
		})
	);
	if (innMealsCsv) {
		csvFiles["logs/78_inn_meals.csv"] = innMealsCsv;
	}
}

/**
 * Exports inn room rentals by the player (file 79)
 */
async function exportInnRooms(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const innRoomsCsv = await streamToCSV(
		LogsInnRooms,
		{ playerId: logsPlayerId },
		r => ({
			cityId: r.cityId,
			innId: r.innId,
			roomId: r.roomId,
			price: r.price,
			healthGained: r.healthGained,
			healthBefore: r.healthBefore,
			date: r.date
		})
	);
	if (innRoomsCsv) {
		csvFiles["logs/79_inn_rooms.csv"] = innRoomsCsv;
	}
}

/**
 * Exports city interaction data from the logs database.
 *
 * This exporter is intentionally grouped per city feature; new feature
 * batches (blacksmith, enchanter, housing, apartments, shops, guild domain,
 * home features, city visits) will plug into this same file in subsequent
 * phases.
 */
export async function exportLogsCity(
	logsPlayerId: number,
	_anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 78. Inn meals purchased
	await exportInnMeals(logsPlayerId, csvFiles);

	// 79. Inn rooms rented
	await exportInnRooms(logsPlayerId, csvFiles);
}
