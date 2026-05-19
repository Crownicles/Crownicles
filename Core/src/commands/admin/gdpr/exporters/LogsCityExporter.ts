import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	GDPRCsvFiles, streamToCSV
} from "../CSVUtils";
import { LogsInnMeals } from "../../../../core/database/logs/models/LogsInnMeals";
import { LogsInnRooms } from "../../../../core/database/logs/models/LogsInnRooms";
import { LogsBlacksmithUpgrades } from "../../../../core/database/logs/models/LogsBlacksmithUpgrades";
import { LogsBlacksmithDisenchants } from "../../../../core/database/logs/models/LogsBlacksmithDisenchants";
import { LogsEnchanterUses } from "../../../../core/database/logs/models/LogsEnchanterUses";
import { LogsHomePurchases } from "../../../../core/database/logs/models/LogsHomePurchases";
import { LogsHomeUpgrades } from "../../../../core/database/logs/models/LogsHomeUpgrades";
import { LogsHomeMoves } from "../../../../core/database/logs/models/LogsHomeMoves";
import { LogsHomeBedUses } from "../../../../core/database/logs/models/LogsHomeBedUses";
import { LogsApartmentPurchases } from "../../../../core/database/logs/models/LogsApartmentPurchases";
import { LogsApartmentRentClaims } from "../../../../core/database/logs/models/LogsApartmentRentClaims";
import { LogsGuildDomainPurchases } from "../../../../core/database/logs/models/LogsGuildDomainPurchases";
import { LogsGuildDomainUpgrades } from "../../../../core/database/logs/models/LogsGuildDomainUpgrades";
import { LogsGuildTreasuryDeposits } from "../../../../core/database/logs/models/LogsGuildTreasuryDeposits";
import { LogsGuildFoodShopBuys } from "../../../../core/database/logs/models/LogsGuildFoodShopBuys";
import { LogsCookingUses } from "../../../../core/database/logs/models/LogsCookingUses";
import { LogsGardenActions } from "../../../../core/database/logs/models/LogsGardenActions";

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
 * Exports home purchases by the player (file 83)
 */
async function exportHomePurchases(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsHomePurchases,
		{ playerId: logsPlayerId },
		h => ({
			cityId: h.cityId,
			price: h.price,
			date: h.date
		})
	);
	if (csv) {
		csvFiles["logs/83_home_purchases.csv"] = csv;
	}
}

/**
 * Exports home upgrades by the player (file 84)
 */
async function exportHomeUpgrades(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsHomeUpgrades,
		{ playerId: logsPlayerId },
		h => ({
			cityId: h.cityId,
			fromLevel: h.fromLevel,
			toLevel: h.toLevel,
			price: h.price,
			date: h.date
		})
	);
	if (csv) {
		csvFiles["logs/84_home_upgrades.csv"] = csv;
	}
}

/**
 * Exports home moves by the player (file 85)
 */
async function exportHomeMoves(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsHomeMoves,
		{ playerId: logsPlayerId },
		h => ({
			fromCityId: h.fromCityId,
			toCityId: h.toCityId,
			basePrice: h.basePrice,
			rentApplied: h.rentApplied,
			effectivePrice: h.effectivePrice,
			date: h.date
		})
	);
	if (csv) {
		csvFiles["logs/85_home_moves.csv"] = csv;
	}
}

/**
 * Exports home bed uses by the player (file 86)
 */
async function exportHomeBedUses(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsHomeBedUses,
		{ playerId: logsPlayerId },
		h => ({
			cityId: h.cityId,
			healthGained: h.healthGained,
			healthBefore: h.healthBefore,
			date: h.date
		})
	);
	if (csv) {
		csvFiles["logs/86_home_bed_uses.csv"] = csv;
	}
}

/**
 * Exports apartment purchases by the player (file 87)
 */
async function exportApartmentPurchases(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsApartmentPurchases,
		{ playerId: logsPlayerId },
		a => ({
			cityId: a.cityId,
			price: a.price,
			date: a.date
		})
	);
	if (csv) {
		csvFiles["logs/87_apartment_purchases.csv"] = csv;
	}
}

/**
 * Exports apartment rent claims by the player (file 88)
 */
async function exportApartmentRentClaims(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsApartmentRentClaims,
		{ playerId: logsPlayerId },
		a => ({
			apartmentId: a.apartmentId,
			cityId: a.cityId,
			rentClaimed: a.rentClaimed,
			date: a.date
		})
	);
	if (csv) {
		csvFiles["logs/88_apartment_rent_claims.csv"] = csv;
	}
}

/**
 * Exports guild domain purchases / relocations by the player (file 89)
 */
async function exportGuildDomainPurchases(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsGuildDomainPurchases,
		{ playerId: logsPlayerId },
		g => ({
			guildId: g.guildId,
			cityId: g.cityId,
			fromCityId: g.fromCityId ?? "",
			isRelocation: g.isRelocation,
			cost: g.cost,
			date: g.date
		})
	);
	if (csv) {
		csvFiles["logs/89_guild_domain_purchases.csv"] = csv;
	}
}

/**
 * Exports guild building upgrades by the player (file 90)
 */
async function exportGuildDomainUpgrades(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsGuildDomainUpgrades,
		{ playerId: logsPlayerId },
		g => ({
			guildId: g.guildId,
			cityId: g.cityId,
			building: g.building,
			newLevel: g.newLevel,
			cost: g.cost,
			xpGained: g.xpGained,
			date: g.date
		})
	);
	if (csv) {
		csvFiles["logs/90_guild_domain_upgrades.csv"] = csv;
	}
}

/**
 * Exports guild treasury deposits and reimbursements by the player (file 91)
 */
async function exportGuildTreasuryDeposits(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsGuildTreasuryDeposits,
		{ playerId: logsPlayerId },
		g => ({
			guildId: g.guildId,
			grossAmount: g.grossAmount,
			treasuryDeposited: g.treasuryDeposited,
			penalty: g.penalty,
			isReimburse: g.isReimburse,
			date: g.date
		})
	);
	if (csv) {
		csvFiles["logs/91_guild_treasury_deposits.csv"] = csv;
	}
}

/**
 * Exports guild food shop purchases by the player (file 92)
 */
async function exportGuildFoodShopBuys(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsGuildFoodShopBuys,
		{ playerId: logsPlayerId },
		g => ({
			guildId: g.guildId,
			cityId: g.cityId ?? "",
			foodType: g.foodType,
			amount: g.amount,
			unitPrice: g.unitPrice,
			totalCost: g.totalCost,
			date: g.date
		})
	);
	if (csv) {
		csvFiles["logs/92_guild_food_shop_buys.csv"] = csv;
	}
}

/**
 * Exports cooking craft uses by the player (file 93)
 */
async function exportCookingUses(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsCookingUses,
		{ playerId: logsPlayerId },
		c => ({
			cityId: c.cityId ?? "",
			recipeId: c.recipeId,
			recipeLevel: c.recipeLevel,
			outputType: c.outputType,
			success: c.success,
			bonus: c.bonus,
			wasSecret: c.wasSecret,
			xpGained: c.xpGained,
			levelUp: c.levelUp,
			potionId: c.potionId ?? "",
			foodType: c.foodType ?? "",
			foodStored: c.foodStored ?? "",
			foodSurplus: c.foodSurplus ?? "",
			materialOutputId: c.materialOutputId ?? "",
			date: c.date
		})
	);
	if (csv) {
		csvFiles["logs/93_cooking_uses.csv"] = csv;
	}
}

/**
 * Exports garden actions by the player (file 94)
 */
async function exportGardenActions(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const csv = await streamToCSV(
		LogsGardenActions,
		{ playerId: logsPlayerId },
		g => ({
			cityId: g.cityId ?? "",
			action: g.action,
			plantId: g.plantId,
			slot: g.slot,
			cost: g.cost,
			quantity: g.quantity ?? "",
			date: g.date
		})
	);
	if (csv) {
		csvFiles["logs/94_garden_actions.csv"] = csv;
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

	// 83. Home purchases
	await exportHomePurchases(logsPlayerId, csvFiles);

	// 84. Home upgrades
	await exportHomeUpgrades(logsPlayerId, csvFiles);

	// 85. Home moves
	await exportHomeMoves(logsPlayerId, csvFiles);

	// 86. Home bed uses
	await exportHomeBedUses(logsPlayerId, csvFiles);

	// 87. Apartment purchases
	await exportApartmentPurchases(logsPlayerId, csvFiles);

	// 88. Apartment rent claims
	await exportApartmentRentClaims(logsPlayerId, csvFiles);

	// 89. Guild domain purchases / relocations
	await exportGuildDomainPurchases(logsPlayerId, csvFiles);

	// 90. Guild building upgrades
	await exportGuildDomainUpgrades(logsPlayerId, csvFiles);

	// 91. Guild treasury deposits / reimbursements
	await exportGuildTreasuryDeposits(logsPlayerId, csvFiles);

	// 92. Guild food shop purchases
	await exportGuildFoodShopBuys(logsPlayerId, csvFiles);

	// 93. Cooking craft uses
	await exportCookingUses(logsPlayerId, csvFiles);

	// 94. Garden actions (plant / water / compost / harvest)
	await exportGardenActions(logsPlayerId, csvFiles);
}
