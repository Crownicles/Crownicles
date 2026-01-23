import {
	streamToCSV, GDPRCsvFiles
} from "../CSVUtils";
import { LogsClassicalShopBuyouts } from "../../../../core/database/logs/models/LogsClassicalShopBuyouts";
import { LogsGuildShopBuyouts } from "../../../../core/database/logs/models/LogsGuildShopBuyouts";
import { LogsMissionShopBuyouts } from "../../../../core/database/logs/models/LogsMissionShopBuyouts";
import { LogsItemGainsArmor } from "../../../../core/database/logs/models/LogsItemsGainsArmor";
import { LogsItemGainsWeapon } from "../../../../core/database/logs/models/LogsItemsGainsWeapon";
import { LogsItemGainsObject } from "../../../../core/database/logs/models/LogsItemsGainsObject";
import { LogsItemGainsPotion } from "../../../../core/database/logs/models/LogsItemsGainsPotion";
import { LogsItemSellsArmor } from "../../../../core/database/logs/models/LogsItemsSellsArmor";
import { LogsItemSellsWeapon } from "../../../../core/database/logs/models/LogsItemsSellsWeapon";
import { LogsItemSellsObject } from "../../../../core/database/logs/models/LogsItemsSellsObject";
import { LogsItemSellsPotion } from "../../../../core/database/logs/models/LogsItemsSellsPotion";

/**
 * Helper to export item transactions (gains or sells) for a specific item type
 */
async function exportItemTransaction(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	model: any,
	logsPlayerId: number,
	fileName: string,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		model,
		{ playerId: logsPlayerId },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(i: any) => ({
			itemId: i.itemId, date: i.getDataValue("date")
		})
	);
	if (csv) {
		csvFiles[fileName] = csv;
	}
}

/**
 * Exports shop buyouts (classical, guild, mission)
 */
async function exportShopBuyouts(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	const classicalBuyoutsCsv = await streamToCSV(
		LogsClassicalShopBuyouts,
		{ playerId: logsPlayerId },
		b => ({
			shopItem: b.shopItem, amount: b.amount, date: b.date
		})
	);
	if (classicalBuyoutsCsv) {
		csvFiles["logs/49_classical_shop_buyouts.csv"] = classicalBuyoutsCsv;
	}

	const guildBuyoutsCsv = await streamToCSV(
		LogsGuildShopBuyouts,
		{ playerId: logsPlayerId },
		b => ({
			shopItem: b.shopItem, amount: b.amount, date: b.date
		})
	);
	if (guildBuyoutsCsv) {
		csvFiles["logs/50_guild_shop_buyouts.csv"] = guildBuyoutsCsv;
	}

	const missionBuyoutsCsv = await streamToCSV(
		LogsMissionShopBuyouts,
		{ playerId: logsPlayerId },
		b => ({
			shopItem: b.shopItem, date: b.date
		})
	);
	if (missionBuyoutsCsv) {
		csvFiles["logs/51_mission_shop_buyouts.csv"] = missionBuyoutsCsv;
	}
}

/**
 * Exports item gains for all item types
 */
async function exportItemGains(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	await exportItemTransaction(LogsItemGainsArmor, logsPlayerId, "logs/52_item_gains_armor.csv", csvFiles);
	await exportItemTransaction(LogsItemGainsWeapon, logsPlayerId, "logs/53_item_gains_weapon.csv", csvFiles);
	await exportItemTransaction(LogsItemGainsObject, logsPlayerId, "logs/54_item_gains_object.csv", csvFiles);
	await exportItemTransaction(LogsItemGainsPotion, logsPlayerId, "logs/55_item_gains_potion.csv", csvFiles);
}

/**
 * Exports item sells for all item types
 */
async function exportItemSells(logsPlayerId: number, csvFiles: GDPRCsvFiles): Promise<void> {
	await exportItemTransaction(LogsItemSellsArmor, logsPlayerId, "logs/56_item_sells_armor.csv", csvFiles);
	await exportItemTransaction(LogsItemSellsWeapon, logsPlayerId, "logs/57_item_sells_weapon.csv", csvFiles);
	await exportItemTransaction(LogsItemSellsObject, logsPlayerId, "logs/58_item_sells_object.csv", csvFiles);
	await exportItemTransaction(LogsItemSellsPotion, logsPlayerId, "logs/59_item_sells_potion.csv", csvFiles);
}

/**
 * Exports shop buyouts and item transactions from logs database (files 49-59)
 */
export async function exportLogsShop(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 49-51. Shop buyouts
	await exportShopBuyouts(logsPlayerId, csvFiles);

	// 52-55. Item gains
	await exportItemGains(logsPlayerId, csvFiles);

	// 56-59. Item sells
	await exportItemSells(logsPlayerId, csvFiles);
}
