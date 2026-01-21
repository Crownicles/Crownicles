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
 * Exports shop buyouts and item transactions from logs database (files 49-59)
 */
export async function exportLogsShop(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 49. Classical shop buyouts
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

	// 50. Guild shop buyouts
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

	// 51. Mission shop buyouts
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

	// 52-55. Item gains (armor, weapon, object, potion)
	const armorGainsCsv = await streamToCSV(
		LogsItemGainsArmor,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (armorGainsCsv) {
		csvFiles["logs/52_item_gains_armor.csv"] = armorGainsCsv;
	}

	const weaponGainsCsv = await streamToCSV(
		LogsItemGainsWeapon,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (weaponGainsCsv) {
		csvFiles["logs/53_item_gains_weapon.csv"] = weaponGainsCsv;
	}

	const objectGainsCsv = await streamToCSV(
		LogsItemGainsObject,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (objectGainsCsv) {
		csvFiles["logs/54_item_gains_object.csv"] = objectGainsCsv;
	}

	const potionGainsCsv = await streamToCSV(
		LogsItemGainsPotion,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (potionGainsCsv) {
		csvFiles["logs/55_item_gains_potion.csv"] = potionGainsCsv;
	}

	// 56-59. Item sells
	const armorSellsCsv = await streamToCSV(
		LogsItemSellsArmor,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (armorSellsCsv) {
		csvFiles["logs/56_item_sells_armor.csv"] = armorSellsCsv;
	}

	const weaponSellsCsv = await streamToCSV(
		LogsItemSellsWeapon,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (weaponSellsCsv) {
		csvFiles["logs/57_item_sells_weapon.csv"] = weaponSellsCsv;
	}

	const objectSellsCsv = await streamToCSV(
		LogsItemSellsObject,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (objectSellsCsv) {
		csvFiles["logs/58_item_sells_object.csv"] = objectSellsCsv;
	}

	const potionSellsCsv = await streamToCSV(
		LogsItemSellsPotion,
		{ playerId: logsPlayerId },
		i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})
	);
	if (potionSellsCsv) {
		csvFiles["logs/59_item_sells_potion.csv"] = potionSellsCsv;
	}
}
