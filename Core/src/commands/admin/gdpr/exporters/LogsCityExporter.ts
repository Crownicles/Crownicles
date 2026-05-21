import {
	Model, ModelStatic, WhereOptions
} from "sequelize";
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
import { LogsCityVisits } from "../../../../core/database/logs/models/LogsCityVisits";

interface LogsPlayerRow extends Model {
	readonly playerId: number;
}

interface ExportLogTableParams<T extends LogsPlayerRow> {
	logsPlayerId: number;
	csvFiles: GDPRCsvFiles;
	filePath: string;
	model: ModelStatic<T>;
	transform: (row: T) => Record<string, unknown>;
}

async function exportLogTable<T extends LogsPlayerRow>(params: ExportLogTableParams<T>): Promise<void> {
	const where = { playerId: params.logsPlayerId } as WhereOptions<T>;
	const csv = await streamToCSV(
		params.model,
		where,
		params.transform
	);
	if (csv) {
		params.csvFiles[params.filePath] = csv;
	}
}

/**
 * Exports city interaction data from the logs database.
 *
 * This exporter is intentionally grouped per city feature so the GDPR export
 * order mirrors the city logs migrations.
 */
export async function exportLogsCity(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/78_inn_meals.csv",
		model: LogsInnMeals,
		transform: meal => ({
			cityId: meal.cityId,
			innId: meal.innId,
			mealId: meal.mealId,
			price: meal.price,
			energyGained: meal.energyGained,
			energyBefore: meal.energyBefore,
			date: meal.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/79_inn_rooms.csv",
		model: LogsInnRooms,
		transform: room => ({
			cityId: room.cityId,
			innId: room.innId,
			roomId: room.roomId,
			price: room.price,
			healthGained: room.healthGained,
			healthBefore: room.healthBefore,
			date: room.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/80_blacksmith_upgrades.csv",
		model: LogsBlacksmithUpgrades,
		transform: upgrade => ({
			cityId: upgrade.cityId,
			itemCategory: upgrade.itemCategory,
			slot: upgrade.slot,
			fromLevel: upgrade.fromLevel,
			toLevel: upgrade.toLevel,
			totalCost: upgrade.totalCost,
			boughtMaterials: upgrade.boughtMaterials,
			materialsCost: upgrade.materialsCost,
			date: upgrade.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/81_blacksmith_disenchants.csv",
		model: LogsBlacksmithDisenchants,
		transform: disenchant => ({
			cityId: disenchant.cityId,
			itemCategory: disenchant.itemCategory,
			slot: disenchant.slot,
			cost: disenchant.cost,
			date: disenchant.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/82_enchanter_uses.csv",
		model: LogsEnchanterUses,
		transform: use => ({
			cityId: use.cityId,
			itemCategory: use.itemCategory,
			slot: use.slot,
			enchantmentId: use.enchantmentId,
			enchantmentType: use.enchantmentType,
			moneyPrice: use.moneyPrice,
			gemsPrice: use.gemsPrice,
			date: use.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/83_home_purchases.csv",
		model: LogsHomePurchases,
		transform: purchase => ({
			cityId: purchase.cityId,
			price: purchase.price,
			date: purchase.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/84_home_upgrades.csv",
		model: LogsHomeUpgrades,
		transform: upgrade => ({
			cityId: upgrade.cityId,
			fromLevel: upgrade.fromLevel,
			toLevel: upgrade.toLevel,
			price: upgrade.price,
			date: upgrade.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/85_home_moves.csv",
		model: LogsHomeMoves,
		transform: move => ({
			fromCityId: move.fromCityId,
			toCityId: move.toCityId,
			basePrice: move.basePrice,
			rentApplied: move.rentApplied,
			effectivePrice: move.effectivePrice,
			date: move.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/86_home_bed_uses.csv",
		model: LogsHomeBedUses,
		transform: bedUse => ({
			cityId: bedUse.cityId,
			healthGained: bedUse.healthGained,
			healthBefore: bedUse.healthBefore,
			date: bedUse.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/87_apartment_purchases.csv",
		model: LogsApartmentPurchases,
		transform: purchase => ({
			cityId: purchase.cityId,
			price: purchase.price,
			date: purchase.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/88_apartment_rent_claims.csv",
		model: LogsApartmentRentClaims,
		transform: claim => ({
			apartmentId: claim.apartmentId,
			cityId: claim.cityId,
			rentClaimed: claim.rentClaimed,
			date: claim.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/89_guild_domain_purchases.csv",
		model: LogsGuildDomainPurchases,
		transform: purchase => ({
			guildId: anonymizer.anonymizeGuildId(purchase.guildId),
			cityId: purchase.cityId,
			fromCityId: purchase.fromCityId ?? "",
			isRelocation: purchase.isRelocation,
			cost: purchase.cost,
			date: purchase.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/90_guild_domain_upgrades.csv",
		model: LogsGuildDomainUpgrades,
		transform: upgrade => ({
			guildId: anonymizer.anonymizeGuildId(upgrade.guildId),
			cityId: upgrade.cityId,
			building: upgrade.building,
			newLevel: upgrade.newLevel,
			cost: upgrade.cost,
			xpGained: upgrade.xpGained,
			date: upgrade.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/91_guild_treasury_deposits.csv",
		model: LogsGuildTreasuryDeposits,
		transform: deposit => ({
			guildId: anonymizer.anonymizeGuildId(deposit.guildId),
			grossAmount: deposit.grossAmount,
			treasuryDeposited: deposit.treasuryDeposited,
			penalty: deposit.penalty,
			isReimburse: deposit.isReimburse,
			date: deposit.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/92_guild_food_shop_buys.csv",
		model: LogsGuildFoodShopBuys,
		transform: purchase => ({
			guildId: anonymizer.anonymizeGuildId(purchase.guildId),
			cityId: purchase.cityId ?? "",
			foodType: purchase.foodType,
			amount: purchase.amount,
			unitPrice: purchase.unitPrice,
			totalCost: purchase.totalCost,
			date: purchase.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/93_cooking_uses.csv",
		model: LogsCookingUses,
		transform: use => ({
			cityId: use.cityId ?? "",
			recipeId: use.recipeId,
			recipeLevel: use.recipeLevel,
			outputType: use.outputType,
			success: use.success,
			bonus: use.bonus,
			wasSecret: use.wasSecret,
			xpGained: use.xpGained,
			levelUp: use.levelUp,
			potionId: use.potionId ?? "",
			foodType: use.foodType ?? "",
			foodStored: use.foodStored ?? "",
			foodSurplus: use.foodSurplus ?? "",
			materialOutputId: use.materialOutputId ?? "",
			date: use.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/94_garden_actions.csv",
		model: LogsGardenActions,
		transform: action => ({
			cityId: action.cityId ?? "",
			action: action.action,
			plantId: action.plantId,
			slot: action.slot,
			cost: action.cost,
			quantity: action.quantity ?? "",
			date: action.date
		})
	});
	await exportLogTable({
		logsPlayerId,
		csvFiles,
		filePath: "logs/95_city_visits.csv",
		model: LogsCityVisits,
		transform: visit => ({
			cityId: visit.cityId,
			enterDate: visit.enterDate,
			exitDate: visit.exitDate ?? "",
			exitReason: visit.exitReason,
			menusOpenedMask: visit.menusOpenedMask
		})
	});
}
