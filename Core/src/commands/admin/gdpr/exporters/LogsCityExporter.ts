import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV
} from "../CSVUtils";
import { LogsInnMeals } from "../../../../core/database/logs/models/LogsInnMeals";
import { LogsInnRooms } from "../../../../core/database/logs/models/LogsInnRooms";
import { LogsBlacksmithUpgrades } from "../../../../core/database/logs/models/LogsBlacksmithUpgrades";
import { LogsBlacksmithDisenchants } from "../../../../core/database/logs/models/LogsBlacksmithDisenchants";
import { LogsEnchanterUses } from "../../../../core/database/logs/models/LogsEnchanterUses";

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
 * Exports blacksmith upgrades by the player (file 80)
 */
async function exportBlacksmithUpgrades(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const upgradesCsv = await streamToCSV(
		LogsBlacksmithUpgrades,
		{ playerId: logsPlayerId },
		u => ({
			cityId: u.cityId,
			itemCategory: u.itemCategory,
			slot: u.slot,
			fromLevel: u.fromLevel,
			toLevel: u.toLevel,
			totalCost: u.totalCost,
			boughtMaterials: u.boughtMaterials,
			materialsCost: u.materialsCost,
			date: u.date
		})
	);
	if (upgradesCsv) {
		csvFiles["logs/80_blacksmith_upgrades.csv"] = upgradesCsv;
	}
}

/**
 * Exports blacksmith disenchants by the player (file 81)
 */
async function exportBlacksmithDisenchants(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const disenchantsCsv = await streamToCSV(
		LogsBlacksmithDisenchants,
		{ playerId: logsPlayerId },
		d => ({
			cityId: d.cityId,
			itemCategory: d.itemCategory,
			slot: d.slot,
			cost: d.cost,
			date: d.date
		})
	);
	if (disenchantsCsv) {
		csvFiles["logs/81_blacksmith_disenchants.csv"] = disenchantsCsv;
	}
}

/**
 * Exports enchanter uses by the player (file 82)
 */
async function exportEnchanterUses(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const enchanterCsv = await streamToCSV(
		LogsEnchanterUses,
		{ playerId: logsPlayerId },
		e => ({
			cityId: e.cityId,
			itemCategory: e.itemCategory,
			slot: e.slot,
			enchantmentId: e.enchantmentId,
			enchantmentType: e.enchantmentType,
			moneyPrice: e.moneyPrice,
			gemsPrice: e.gemsPrice,
			date: e.date
		})
	);
	if (enchanterCsv) {
		csvFiles["logs/82_enchanter_uses.csv"] = enchanterCsv;
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

	// 80. Blacksmith upgrades
	await exportBlacksmithUpgrades(logsPlayerId, csvFiles);

	// 81. Blacksmith disenchants
	await exportBlacksmithDisenchants(logsPlayerId, csvFiles);

	// 82. Enchanter uses
	await exportEnchanterUses(logsPlayerId, csvFiles);
}
