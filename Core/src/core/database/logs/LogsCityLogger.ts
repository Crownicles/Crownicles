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
import { LogsCityVisits } from "./models/LogsCityVisits";
import { findOrCreateLogsPlayer } from "./LogsPlayerResolver";
import { findOrCreateLogsGuild } from "./LogsGuildResolver";
import { getDateLogs } from "../../../../../Lib/src/utils/TimeUtils";
import {
	Guild
} from "../game/models/Guild";
import { GuildLikeType } from "../../types/GuildLikeType";

type LogDate = ReturnType<typeof getDateLogs>;

type GuildLogSource = Guild | GuildLikeType;

async function resolveLogsPlayerId(keycloakId: string): Promise<number | null> {
	const player = await findOrCreateLogsPlayer(keycloakId);
	return player?.id ?? null;
}

async function createDatedLogEntry(
	keycloakId: string,
	create: (playerId: number, date: LogDate) => Promise<unknown>
): Promise<void> {
	const playerId = await resolveLogsPlayerId(keycloakId);
	if (playerId === null) {
		return;
	}
	await create(playerId, getDateLogs());
}

async function createPlayerLogEntry(
	keycloakId: string,
	create: (playerId: number) => Promise<unknown>
): Promise<void> {
	const playerId = await resolveLogsPlayerId(keycloakId);
	if (playerId === null) {
		return;
	}
	await create(playerId);
}

async function createDatedPlayerGuildLogEntry(
	keycloakId: string,
	guild: GuildLogSource,
	create: (playerId: number, guildId: number, date: LogDate) => Promise<unknown>
): Promise<void> {
	const playerId = await resolveLogsPlayerId(keycloakId);
	if (playerId === null) {
		return;
	}
	const logGuild = await findOrCreateLogsGuild(guild);
	await create(playerId, logGuild.id, getDateLogs());
}

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
	guild: GuildLogSource;
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
	guild: GuildLogSource;
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
	guild: GuildLogSource;
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
	guild: GuildLogSource;
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
 * Reason a city visit ended.
 */
export const CityVisitExitReason = {
	REFUSE: 0,
	EXIT_BUTTON: 1,
	TIMEOUT: 2,
	ENGAGED: 3
} as const;

export type CityVisitExitReasonValue = typeof CityVisitExitReason[keyof typeof CityVisitExitReason];

/**
 * Bitmask of sub-menus opened during a city visit. Combined via bitwise OR.
 */
export const CityMenuMask = {
	INN: 1,
	BLACKSMITH: 2,
	ENCHANTER: 4,
	SHOP: 8,
	NOTARY: 16,
	HOME: 32,
	GUILD_DOMAIN: 64,
	GARDEN_OR_COOKING: 128,
	ROYAL_BLACKSMITH: 256
} as const;

export interface CityVisitLogParams {
	keycloakId: string;
	cityId: string;
	enterDate: number;
	exitDate: number | null;
	exitReason: CityVisitExitReasonValue;
	menusOpenedMask: number;
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
	 * Log when a player buys a meal at a city inn.
	 *
	 * The `energyBefore` field is optional and provides the player's energy
	 * level **before** the meal was applied. Combined with `energyGained`
	 * and the player's max energy at log time, it lets us measure energy
	 * waste (the overflow when a near-full player buys an expensive meal).
	 */
	async logInnMeal({
		keycloakId, ...fields
	}: InnMealLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsInnMeals.create({
			playerId,
			...fields,
			date
		}));
	}

	/**
	 * Log when a player rents a room at a city inn.
	 *
	 * Same rationale as {@link logInnMeal} for the `healthBefore` field:
	 * measures how often players rent expensive rooms while already near
	 * full health.
	 */
	async logInnRoom({
		keycloakId, ...fields
	}: InnRoomLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsInnRooms.create({
			playerId,
			...fields,
			date
		}));
	}

	/**
	 * Log when a player upgrades an item at the city blacksmith.
	 *
	 * `materialsCost` is set only when `boughtMaterials === true` (the
	 * player paid in coins for missing materials). When materials are
	 * supplied from the player's inventory, the field is null.
	 */
	async logBlacksmithUpgrade({
		keycloakId, ...fields
	}: BlacksmithUpgradeLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsBlacksmithUpgrades.create({
			playerId,
			...fields,
			date
		}));
	}

	/**
	 * Log when a player removes an enchantment from an item at the city blacksmith.
	 */
	async logBlacksmithDisenchant({
		keycloakId, ...fields
	}: BlacksmithDisenchantLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsBlacksmithDisenchants.create({
			playerId,
			...fields,
			date
		}));
	}

	/**
	 * Log when a player enchants an item at the city enchanter.
	 */
	async logEnchanterUse({
		keycloakId, ...fields
	}: EnchanterUseLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsEnchanterUses.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player buys a home in a city. */
	async logHomePurchase({
		keycloakId, ...fields
	}: HomePurchaseLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsHomePurchases.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player upgrades their home level. */
	async logHomeUpgrade({
		keycloakId, ...fields
	}: HomeUpgradeLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsHomeUpgrades.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player moves their home to another city. */
	async logHomeMove({
		keycloakId, ...fields
	}: HomeMoveLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsHomeMoves.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player uses their home bed to heal. */
	async logHomeBedUse({
		keycloakId, ...fields
	}: HomeBedUseLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsHomeBedUses.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player buys an apartment in a city. */
	async logApartmentPurchase({
		keycloakId, ...fields
	}: ApartmentPurchaseLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsApartmentPurchases.create({
			playerId,
			...fields,
			date
		}));
	}

	/** Log when a player claims accumulated rent from an apartment they own. */
	async logApartmentRentClaim({
		keycloakId, ...fields
	}: ApartmentRentClaimLogParams): Promise<void> {
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsApartmentRentClaims.create({
			playerId,
			...fields,
			date
		}));
	}

	/**
	 * Log when a guild chief buys or relocates the guild domain via the city notary.
	 *
	 * For an initial purchase, `fromCityId` is null and `isRelocation` is false.
	 * For a relocation, `fromCityId` is the previous domain city and `cost` is the
	 * relocation fee (which differs from the purchase fee).
	 */
	async logGuildDomainPurchase({
		keycloakId, guild, ...fields
	}: GuildDomainPurchaseLogParams): Promise<void> {
		await createDatedPlayerGuildLogEntry(keycloakId, guild, (playerId, guildId, date) => LogsGuildDomainPurchases.create({
			playerId,
			guildId,
			...fields,
			date
		}));
	}

	/** Log when a guild chief upgrades a guild building. */
	async logGuildDomainUpgrade({
		keycloakId, guild, ...fields
	}: GuildDomainUpgradeLogParams): Promise<void> {
		await createDatedPlayerGuildLogEntry(keycloakId, guild, (playerId, guildId, date) => LogsGuildDomainUpgrades.create({
			playerId,
			guildId,
			...fields,
			date
		}));
	}

	/**
	 * Log a deposit (or chief reimbursement) into the guild treasury.
	 *
	 * `penalty` is the fraction skimmed off non-reimbursement deposits; when
	 * `isReimburse === true`, penalty is 0 and `treasuryDeposited === grossAmount`.
	 */
	async logGuildTreasuryDeposit({
		keycloakId, guild, ...fields
	}: GuildTreasuryDepositLogParams): Promise<void> {
		await createDatedPlayerGuildLogEntry(keycloakId, guild, (playerId, guildId, date) => LogsGuildTreasuryDeposits.create({
			playerId,
			guildId,
			...fields,
			date
		}));
	}

	/** Log when a guild member buys pet food from the guild food shop. */
	async logGuildFoodShopBuy({
		keycloakId, guild, ...fields
	}: GuildFoodShopBuyLogParams): Promise<void> {
		await createDatedPlayerGuildLogEntry(keycloakId, guild, (playerId, guildId, date) => LogsGuildFoodShopBuys.create({
			playerId,
			guildId,
			...fields,
			date
		}));
	}

	/** Log a cooking craft attempt (success or failure). */
	async logCookingUse(params: CookingUseLogParams): Promise<void> {
		const {
			keycloakId, potionId, foodType, foodStored, foodSurplus, materialOutputId, ...fields
		} = params;
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsCookingUses.create({
			playerId,
			...fields,
			potionId: potionId ?? null,
			foodType: foodType ?? null,
			foodStored: foodStored ?? null,
			foodSurplus: foodSurplus ?? null,
			materialOutputId: materialOutputId ?? null,
			date
		}));
	}

	/** Log a garden action (plant/water/compost/harvest). */
	async logGardenAction(params: GardenActionLogParams): Promise<void> {
		const {
			keycloakId, quantity, ...fields
		} = params;
		await createDatedLogEntry(keycloakId, (playerId, date) => LogsGardenActions.create({
			playerId,
			...fields,
			quantity: quantity ?? null,
			date
		}));
	}

	/** Log a passive city visit (entry + exit + opened-menus bitmask). */
	async logCityVisit({
		keycloakId, ...fields
	}: CityVisitLogParams): Promise<void> {
		await createPlayerLogEntry(keycloakId, playerId => LogsCityVisits.create({
			playerId,
			...fields
		}));
	}
}
