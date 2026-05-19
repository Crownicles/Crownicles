import { LogsInnMeals } from "./models/LogsInnMeals";
import { LogsInnRooms } from "./models/LogsInnRooms";
import { LogsBlacksmithUpgrades } from "./models/LogsBlacksmithUpgrades";
import { LogsBlacksmithDisenchants } from "./models/LogsBlacksmithDisenchants";
import { LogsEnchanterUses } from "./models/LogsEnchanterUses";
import { LogsHomePurchases } from "./models/LogsHomePurchases";
import { LogsHomeUpgrades } from "./models/LogsHomeUpgrades";
import { LogsHomeMoves } from "./models/LogsHomeMoves";
import { LogsHomeBedUses } from "./models/LogsHomeBedUses";
import { LogsApartmentPurchases } from "./models/LogsApartmentPurchases";
import { LogsApartmentRentClaims } from "./models/LogsApartmentRentClaims";
import { LogsGuildDomainPurchases } from "./models/LogsGuildDomainPurchases";
import { LogsGuildDomainUpgrades } from "./models/LogsGuildDomainUpgrades";
import { LogsGuildTreasuryDeposits } from "./models/LogsGuildTreasuryDeposits";
import { LogsGuildFoodShopBuys } from "./models/LogsGuildFoodShopBuys";
import { LogsCookingUses } from "./models/LogsCookingUses";
import { LogsGardenActions } from "./models/LogsGardenActions";
import { LogsPlayers } from "./models/LogsPlayers";
import { getDateLogs } from "../../../../../Lib/src/utils/TimeUtils";

/**
 * Parameters for logging an inn meal purchase
 */
export interface InnMealLogParams {
	keycloakId: string;
	cityId: string;
	innId: string;
	mealId: string;
	price: number;
	energyGained: number;
	energyBefore: number | null;
}

/**
 * Parameters for logging an inn room rental
 */
export interface InnRoomLogParams {
	keycloakId: string;
	cityId: string;
	innId: string;
	roomId: string;
	price: number;
	healthGained: number;
	healthBefore: number | null;
}

/**
 * Parameters for logging a blacksmith upgrade purchase
 */
export interface BlacksmithUpgradeLogParams {
	keycloakId: string;
	cityId: string;
	itemCategory: number;
	slot: number;
	fromLevel: number;
	toLevel: number;
	totalCost: number;
	boughtMaterials: boolean;
	materialsCost: number | null;
}

/**
 * Parameters for logging a blacksmith disenchant
 */
export interface BlacksmithDisenchantLogParams {
	keycloakId: string;
	cityId: string;
	itemCategory: number;
	slot: number;
	cost: number;
}

/**
 * Parameters for logging an enchanter use
 */
export interface EnchanterUseLogParams {
	keycloakId: string;
	cityId: string;
	itemCategory: number;
	slot: number;
	enchantmentId: string;
	enchantmentType: string;
	moneyPrice: number;
	gemsPrice: number;
}

/**
 * Parameters for logging a home purchase
 */
export interface HomePurchaseLogParams {
	keycloakId: string;
	cityId: string;
	price: number;
}

/**
 * Parameters for logging a home upgrade
 */
export interface HomeUpgradeLogParams {
	keycloakId: string;
	cityId: string;
	fromLevel: number;
	toLevel: number;
	price: number;
}

/**
 * Parameters for logging a home move
 *
 * `rentApplied` is the rent surplus from the source apartment that was
 * deducted from the move price; `effectivePrice = basePrice - rentApplied`.
 */
export interface HomeMoveLogParams {
	keycloakId: string;
	fromCityId: string;
	toCityId: string;
	basePrice: number;
	rentApplied: number;
	effectivePrice: number;
}

/**
 * Parameters for logging a home bed use
 */
export interface HomeBedUseLogParams {
	keycloakId: string;
	cityId: string;
	healthGained: number;
	healthBefore: number | null;
}

/**
 * Parameters for logging an apartment purchase
 */
export interface ApartmentPurchaseLogParams {
	keycloakId: string;
	cityId: string;
	price: number;
}

/**
 * Parameters for logging an apartment rent claim
 */
export interface ApartmentRentClaimLogParams {
	keycloakId: string;
	apartmentId: number;
	cityId: string;
	rentClaimed: number;
}

/**
 * Parameters for logging a guild domain purchase or relocation at the city notary
 */
export interface GuildDomainPurchaseLogParams {
	keycloakId: string;
	guildId: number;
	cityId: string;
	fromCityId: string | null;
	isRelocation: boolean;
	cost: number;
}

/**
 * Parameters for logging a guild building upgrade
 */
export interface GuildDomainUpgradeLogParams {
	keycloakId: string;
	guildId: number;
	cityId: string;
	building: string;
	newLevel: number;
	cost: number;
	xpGained: number;
}

/**
 * Parameters for logging a treasury deposit (or chief reimbursement) at the guild domain
 */
export interface GuildTreasuryDepositLogParams {
	keycloakId: string;
	guildId: number;
	grossAmount: number;
	treasuryDeposited: number;
	penalty: number;
	isReimburse: boolean;
}

/**
 * Parameters for logging a guild food shop purchase
 */
export interface GuildFoodShopBuyLogParams {
	keycloakId: string;
	guildId: number;
	cityId: string | null;
	foodType: string;
	amount: number;
	unitPrice: number;
	totalCost: number;
}

/**
 * Garden action discriminator stored in `garden_actions.action`.
 * Keep numerically stable: existing rows reference these values.
 */
export const GardenActionType = {
	PLANT: 0,
	WATER: 1,
	COMPOST: 2,
	HARVEST: 3
} as const;
export type GardenActionTypeValue = typeof GardenActionType[keyof typeof GardenActionType];

/**
 * Parameters for logging a cooking craft attempt (success or failure).
 */
export interface CookingUseLogParams {
	keycloakId: string;
	cityId: string | null;
	recipeId: string;
	recipeLevel: number;
	outputType: string;
	success: boolean;
	bonus: boolean;
	wasSecret: boolean;
	xpGained: number;
	levelUp: boolean;
	potionId?: number | null;
	foodType?: string | null;
	foodStored?: number | null;
	foodSurplus?: number | null;
	materialOutputId?: number | null;
}

/**
 * Parameters for logging a garden action (plant/water/compost/harvest).
 */
export interface GardenActionLogParams {
	keycloakId: string;
	cityId: string | null;
	action: GardenActionTypeValue;
	plantId: string;
	slot: number;
	cost: number;
	quantity?: number | null;
}

/**
 * Handles all city-related logging operations: inns, blacksmith, enchanter,
 * housing (homes, apartments), city shops, guild domain and home features
 * (cooking, garden). Extracted from LogsDatabase to keep the central facade
 * focused on its own legacy responsibilities.
 *
 * Each method follows the same fire-and-forget contract as the rest of the
 * logs subsystem: callers invoke `logXxx(...).then()` and never await — the
 * write goes to a separate database via a separate Sequelize instance, so
 * it cannot affect the game-side transaction.
 */
export class LogsCityLogger {
	/**
	 * Find or create a player in the logs database by keycloak ID
	 */
	private async findOrCreatePlayer(keycloakId: string): Promise<LogsPlayers | null> {
		if (!keycloakId) {
			return null;
		}
		return (await LogsPlayers.findOrCreate({
			where: { keycloakId }
		}))[0];
	}

	/**
	 * Log when a player buys a meal at a city inn.
	 *
	 * The `energyBefore` field is optional and provides the player's energy
	 * level **before** the meal was applied. Combined with `energyGained`
	 * and the player's max energy at log time, it lets us measure energy
	 * waste (the overflow when a near-full player buys an expensive meal).
	 */
	async logInnMeal(params: InnMealLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsInnMeals.create({
			playerId: player.id,
			cityId: params.cityId,
			innId: params.innId,
			mealId: params.mealId,
			price: params.price,
			energyGained: params.energyGained,
			energyBefore: params.energyBefore,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player rents a room at a city inn.
	 *
	 * Same rationale as {@link logInnMeal} for the `healthBefore` field:
	 * measures how often players rent expensive rooms while already near
	 * full health.
	 */
	async logInnRoom(params: InnRoomLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsInnRooms.create({
			playerId: player.id,
			cityId: params.cityId,
			innId: params.innId,
			roomId: params.roomId,
			price: params.price,
			healthGained: params.healthGained,
			healthBefore: params.healthBefore,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player upgrades an item at the city blacksmith.
	 *
	 * `materialsCost` is set only when `boughtMaterials === true` (the
	 * player paid in coins for missing materials). When materials are
	 * supplied from the player's inventory, the field is null.
	 */
	async logBlacksmithUpgrade(params: BlacksmithUpgradeLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsBlacksmithUpgrades.create({
			playerId: player.id,
			cityId: params.cityId,
			itemCategory: params.itemCategory,
			slot: params.slot,
			fromLevel: params.fromLevel,
			toLevel: params.toLevel,
			totalCost: params.totalCost,
			boughtMaterials: params.boughtMaterials,
			materialsCost: params.materialsCost,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player removes an enchantment from an item at the city blacksmith.
	 */
	async logBlacksmithDisenchant(params: BlacksmithDisenchantLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsBlacksmithDisenchants.create({
			playerId: player.id,
			cityId: params.cityId,
			itemCategory: params.itemCategory,
			slot: params.slot,
			cost: params.cost,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player enchants an item at the city enchanter.
	 */
	async logEnchanterUse(params: EnchanterUseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsEnchanterUses.create({
			playerId: player.id,
			cityId: params.cityId,
			itemCategory: params.itemCategory,
			slot: params.slot,
			enchantmentId: params.enchantmentId,
			enchantmentType: params.enchantmentType,
			moneyPrice: params.moneyPrice,
			gemsPrice: params.gemsPrice,
			date: getDateLogs()
		});
	}

	/** Log when a player buys a home in a city. */
	async logHomePurchase(params: HomePurchaseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsHomePurchases.create({
			playerId: player.id,
			cityId: params.cityId,
			price: params.price,
			date: getDateLogs()
		});
	}

	/** Log when a player upgrades their home level. */
	async logHomeUpgrade(params: HomeUpgradeLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsHomeUpgrades.create({
			playerId: player.id,
			cityId: params.cityId,
			fromLevel: params.fromLevel,
			toLevel: params.toLevel,
			price: params.price,
			date: getDateLogs()
		});
	}

	/** Log when a player moves their home to another city. */
	async logHomeMove(params: HomeMoveLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsHomeMoves.create({
			playerId: player.id,
			fromCityId: params.fromCityId,
			toCityId: params.toCityId,
			basePrice: params.basePrice,
			rentApplied: params.rentApplied,
			effectivePrice: params.effectivePrice,
			date: getDateLogs()
		});
	}

	/** Log when a player uses their home bed to heal. */
	async logHomeBedUse(params: HomeBedUseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsHomeBedUses.create({
			playerId: player.id,
			cityId: params.cityId,
			healthGained: params.healthGained,
			healthBefore: params.healthBefore,
			date: getDateLogs()
		});
	}

	/** Log when a player buys an apartment in a city. */
	async logApartmentPurchase(params: ApartmentPurchaseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsApartmentPurchases.create({
			playerId: player.id,
			cityId: params.cityId,
			price: params.price,
			date: getDateLogs()
		});
	}

	/** Log when a player claims accumulated rent from an apartment they own. */
	async logApartmentRentClaim(params: ApartmentRentClaimLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsApartmentRentClaims.create({
			playerId: player.id,
			apartmentId: params.apartmentId,
			cityId: params.cityId,
			rentClaimed: params.rentClaimed,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a guild chief buys or relocates the guild domain via the city notary.
	 *
	 * For an initial purchase, `fromCityId` is null and `isRelocation` is false.
	 * For a relocation, `fromCityId` is the previous domain city and `cost` is the
	 * relocation fee (which differs from the purchase fee).
	 */
	async logGuildDomainPurchase(params: GuildDomainPurchaseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsGuildDomainPurchases.create({
			playerId: player.id,
			guildId: params.guildId,
			cityId: params.cityId,
			fromCityId: params.fromCityId,
			isRelocation: params.isRelocation,
			cost: params.cost,
			date: getDateLogs()
		});
	}

	/** Log when a guild chief upgrades a guild building. */
	async logGuildDomainUpgrade(params: GuildDomainUpgradeLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsGuildDomainUpgrades.create({
			playerId: player.id,
			guildId: params.guildId,
			cityId: params.cityId,
			building: params.building,
			newLevel: params.newLevel,
			cost: params.cost,
			xpGained: params.xpGained,
			date: getDateLogs()
		});
	}

	/**
	 * Log a deposit (or chief reimbursement) into the guild treasury.
	 *
	 * `penalty` is the fraction skimmed off non-reimbursement deposits; when
	 * `isReimburse === true`, penalty is 0 and `treasuryDeposited === grossAmount`.
	 */
	async logGuildTreasuryDeposit(params: GuildTreasuryDepositLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsGuildTreasuryDeposits.create({
			playerId: player.id,
			guildId: params.guildId,
			grossAmount: params.grossAmount,
			treasuryDeposited: params.treasuryDeposited,
			penalty: params.penalty,
			isReimburse: params.isReimburse,
			date: getDateLogs()
		});
	}

	/** Log when a guild member buys pet food from the guild food shop. */
	async logGuildFoodShopBuy(params: GuildFoodShopBuyLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsGuildFoodShopBuys.create({
			playerId: player.id,
			guildId: params.guildId,
			cityId: params.cityId,
			foodType: params.foodType,
			amount: params.amount,
			unitPrice: params.unitPrice,
			totalCost: params.totalCost,
			date: getDateLogs()
		});
	}

	/** Log a cooking craft attempt (success or failure). */
	async logCookingUse(params: CookingUseLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsCookingUses.create({
			playerId: player.id,
			cityId: params.cityId,
			recipeId: params.recipeId,
			recipeLevel: params.recipeLevel,
			outputType: params.outputType,
			success: params.success,
			bonus: params.bonus,
			wasSecret: params.wasSecret,
			xpGained: params.xpGained,
			levelUp: params.levelUp,
			potionId: params.potionId ?? null,
			foodType: params.foodType ?? null,
			foodStored: params.foodStored ?? null,
			foodSurplus: params.foodSurplus ?? null,
			materialOutputId: params.materialOutputId ?? null,
			date: getDateLogs()
		});
	}

	/** Log a garden action (plant/water/compost/harvest). */
	async logGardenAction(params: GardenActionLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsGardenActions.create({
			playerId: player.id,
			cityId: params.cityId,
			action: params.action,
			plantId: params.plantId,
			slot: params.slot,
			cost: params.cost,
			quantity: params.quantity ?? null,
			date: getDateLogs()
		});
	}
}
