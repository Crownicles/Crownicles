import {
	toCSV, GDPRCsvFiles
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
	const classicalBuyouts = await LogsClassicalShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
	if (classicalBuyouts.length > 0) {
		csvFiles["logs/49_classical_shop_buyouts.csv"] = toCSV(classicalBuyouts.map(b => ({
			shopItem: b.shopItem, amount: b.amount, date: b.date
		})));
	}

	// 50. Guild shop buyouts
	const guildBuyouts = await LogsGuildShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
	if (guildBuyouts.length > 0) {
		csvFiles["logs/50_guild_shop_buyouts.csv"] = toCSV(guildBuyouts.map(b => ({
			shopItem: b.shopItem, amount: b.amount, date: b.date
		})));
	}

	// 51. Mission shop buyouts
	const missionBuyouts = await LogsMissionShopBuyouts.findAll({ where: { playerId: logsPlayerId } });
	if (missionBuyouts.length > 0) {
		csvFiles["logs/51_mission_shop_buyouts.csv"] = toCSV(missionBuyouts.map(b => ({
			shopItem: b.shopItem, date: b.date
		})));
	}

	// 52-55. Item gains (armor, weapon, object, potion)
	const armorGains = await LogsItemGainsArmor.findAll({ where: { playerId: logsPlayerId } });
	if (armorGains.length > 0) {
		csvFiles["logs/52_item_gains_armor.csv"] = toCSV(armorGains.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const weaponGains = await LogsItemGainsWeapon.findAll({ where: { playerId: logsPlayerId } });
	if (weaponGains.length > 0) {
		csvFiles["logs/53_item_gains_weapon.csv"] = toCSV(weaponGains.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const objectGains = await LogsItemGainsObject.findAll({ where: { playerId: logsPlayerId } });
	if (objectGains.length > 0) {
		csvFiles["logs/54_item_gains_object.csv"] = toCSV(objectGains.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const potionGains = await LogsItemGainsPotion.findAll({ where: { playerId: logsPlayerId } });
	if (potionGains.length > 0) {
		csvFiles["logs/55_item_gains_potion.csv"] = toCSV(potionGains.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	// 56-59. Item sells
	const armorSells = await LogsItemSellsArmor.findAll({ where: { playerId: logsPlayerId } });
	if (armorSells.length > 0) {
		csvFiles["logs/56_item_sells_armor.csv"] = toCSV(armorSells.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const weaponSells = await LogsItemSellsWeapon.findAll({ where: { playerId: logsPlayerId } });
	if (weaponSells.length > 0) {
		csvFiles["logs/57_item_sells_weapon.csv"] = toCSV(weaponSells.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const objectSells = await LogsItemSellsObject.findAll({ where: { playerId: logsPlayerId } });
	if (objectSells.length > 0) {
		csvFiles["logs/58_item_sells_object.csv"] = toCSV(objectSells.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}

	const potionSells = await LogsItemSellsPotion.findAll({ where: { playerId: logsPlayerId } });
	if (potionSells.length > 0) {
		csvFiles["logs/59_item_sells_potion.csv"] = toCSV(potionSells.map(i => ({
			itemId: i.itemId, date: i.getDataValue("date" as keyof typeof i)
		})));
	}
}
