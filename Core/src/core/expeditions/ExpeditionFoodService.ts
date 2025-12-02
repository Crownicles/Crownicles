import { Pet } from "../../data/Pet";
import Player from "../database/game/models/Player";
import {
	Guild, Guilds
} from "../database/game/models/Guild";
import {
	PetConstants, PetFood
} from "../../../../Lib/src/constants/PetConstants";
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";

/**
 * Re-export PetFood as FoodType for backward compatibility
 */
export type FoodType = PetFood;

/**
 * Configuration for a single food type - organized by food, not by characteristic
 */
interface FoodConfig {
	readonly type: FoodType;
	readonly rations: number;
	readonly price: number;
}

/**
 * All food types configuration indexed by type
 * Uses existing constants from PetConstants and GuildShopConstants
 */
const FOOD_CONFIG_MAP: Record<FoodType, FoodConfig> = {
	commonFood: {
		type: "commonFood",
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[0],
		price: GuildShopConstants.PRICES.FOOD[0]
	},
	herbivorousFood: {
		type: "herbivorousFood",
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[1],
		price: GuildShopConstants.PRICES.FOOD[1]
	},
	carnivorousFood: {
		type: "carnivorousFood",
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[2],
		price: GuildShopConstants.PRICES.FOOD[2]
	},
	ultimateFood: {
		type: "ultimateFood",
		rations: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[3],
		price: GuildShopConstants.PRICES.FOOD[3]
	}
};

/**
 * Get the diet food type based on whether the pet can eat meat
 */
export function getDietFoodType(petModel: Pet): FoodType {
	return petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
}

/**
 * Item in a food consumption plan
 */
export interface FoodConsumptionItem {
	foodType: FoodType;
	itemsToConsume: number;
	rationsProvided: number;
}

/**
 * Food consumption plan for an expedition
 */
export interface FoodConsumptionPlan {
	totalRations: number;
	consumption: FoodConsumptionItem[];
}

/**
 * Internal representation of available food with its config
 */
interface AvailableFoodSlot {
	config: FoodConfig;
	available: number;
}

/**
 * Candidate combination of food items
 */
interface FoodCombination {
	treats: number;
	diet: number;
	soup: number;
	totalRations: number;
	totalCost: number;
	excess: number;
}

/**
 * Get available food slots for a pet from guild storage
 * Returns [treats, diet, soup] in order
 */
function getAvailableFoodSlots(guild: Guild, dietType: FoodType): [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot] {
	return [
		{
			config: FOOD_CONFIG_MAP.commonFood,
			available: guild.commonFood
		},
		{
			config: FOOD_CONFIG_MAP[dietType],
			available: guild[dietType]
		},
		{
			config: FOOD_CONFIG_MAP.ultimateFood,
			available: guild.ultimateFood
		}
	];
}

/**
 * Calculate rations and cost for a combination
 */
function evaluateCombination(
	treats: number,
	diet: number,
	soup: number,
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot],
	rationsRequired: number
): FoodCombination {
	const totalRations = treats * slots[0].config.rations
		+ diet * slots[1].config.rations
		+ soup * slots[2].config.rations;

	const totalCost = treats * slots[0].config.price
		+ diet * slots[1].config.price
		+ soup * slots[2].config.price;

	return {
		treats,
		diet,
		soup,
		totalRations,
		totalCost,
		excess: totalRations - rationsRequired
	};
}

/**
 * Compare two combinations: prefer lower excess, then lower cost
 */
function isBetterCombination(candidate: FoodCombination, current: FoodCombination): boolean {
	if (candidate.excess < current.excess) {
		return true;
	}
	return candidate.excess === current.excess && candidate.totalCost < current.totalCost;
}

/**
 * Find optimal food combination that minimizes excess first, then cost.
 *
 * Algorithm: Smart bounded iteration
 * For each amount of soup (0 to min(available, ceil(required/soupRations)))
 * For each amount of diet (0 to min(available, ceil(remaining/dietRations)))
 * Calculate exact treats needed (with rounding up)
 * If valid, evaluate and compare
 *
 * Complexity: O(S * D) where S = soup items needed, D = diet items needed
 * In practice, this is very small (typically < 10 * 10 = 100 iterations max)
 * Much better than the original O(T * D * S) brute-force with T up to required rations
 */
function findOptimalCombination(
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot],
	rationsRequired: number
): FoodCombination {
	const [
		treatSlot,
		dietSlot,
		soupSlot
	] = slots;

	// Calculate total available rations
	const totalAvailableRations = treatSlot.available * treatSlot.config.rations
		+ dietSlot.available * dietSlot.config.rations
		+ soupSlot.available * soupSlot.config.rations;

	// If not enough food, return all available
	if (totalAvailableRations < rationsRequired) {
		return evaluateCombination(
			treatSlot.available,
			dietSlot.available,
			soupSlot.available,
			slots,
			rationsRequired
		);
	}

	// Bound search space intelligently
	const maxSoup = Math.min(soupSlot.available, Math.ceil(rationsRequired / soupSlot.config.rations));
	const maxDiet = Math.min(dietSlot.available, Math.ceil(rationsRequired / dietSlot.config.rations));

	let best: FoodCombination | null = null;

	// Iterate soup from 0 to max (outer loop on highest ration food for efficiency)
	for (let soup = 0; soup <= maxSoup; soup++) {
		const soupRations = soup * soupSlot.config.rations;
		const remainingAfterSoup = rationsRequired - soupRations;

		// Iterate diet amounts
		for (let diet = 0; diet <= maxDiet; diet++) {
			const dietRations = diet * dietSlot.config.rations;
			const remainingAfterDiet = remainingAfterSoup - dietRations;

			// Calculate minimum treats needed
			const treatsNeeded = remainingAfterDiet > 0
				? Math.ceil(remainingAfterDiet / treatSlot.config.rations)
				: 0;

			// Skip if we need more treats than available
			if (treatsNeeded > treatSlot.available) {
				continue;
			}

			const candidate = evaluateCombination(treatsNeeded, diet, soup, slots, rationsRequired);

			// Only consider combinations that meet the requirement
			if (candidate.totalRations < rationsRequired) {
				continue;
			}

			if (best === null || isBetterCombination(candidate, best)) {
				best = candidate;
			}
		}
	}

	// Fallback (should not happen if totalAvailable >= required)
	return best ?? evaluateCombination(0, 0, 0, slots, rationsRequired);
}

/**
 * Build consumption plan from a combination
 */
function buildPlanFromCombination(
	combination: FoodCombination,
	slots: [AvailableFoodSlot, AvailableFoodSlot, AvailableFoodSlot]
): FoodConsumptionPlan {
	const plan: FoodConsumptionPlan = {
		totalRations: combination.totalRations,
		consumption: []
	};

	if (combination.treats > 0) {
		plan.consumption.push({
			foodType: slots[0].config.type,
			itemsToConsume: combination.treats,
			rationsProvided: combination.treats * slots[0].config.rations
		});
	}

	if (combination.diet > 0) {
		plan.consumption.push({
			foodType: slots[1].config.type,
			itemsToConsume: combination.diet,
			rationsProvided: combination.diet * slots[1].config.rations
		});
	}

	if (combination.soup > 0) {
		plan.consumption.push({
			foodType: slots[2].config.type,
			itemsToConsume: combination.soup,
			rationsProvided: combination.soup * slots[2].config.rations
		});
	}

	return plan;
}

/**
 * Calculate the optimal food consumption plan for an expedition.
 * Minimizes excess rations first, then minimizes total cost.
 *
 * Uses a smart bounded iteration algorithm that is efficient for typical expedition food costs.
 */
export async function calculateFoodConsumptionPlan(
	player: Player,
	petModel: Pet,
	rationsRequired: number
): Promise<FoodConsumptionPlan> {
	const emptyPlan: FoodConsumptionPlan = {
		totalRations: 0,
		consumption: []
	};

	if (!player.guildId) {
		return emptyPlan;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return emptyPlan;
	}

	const dietType = getDietFoodType(petModel);
	const slots = getAvailableFoodSlots(guild, dietType);
	const optimal = findOptimalCombination(slots, rationsRequired);

	return buildPlanFromCombination(optimal, slots);
}

/**
 * Apply the food consumption plan to the guild storage
 */
export async function applyFoodConsumptionPlan(guildId: number, plan: FoodConsumptionPlan): Promise<void> {
	if (plan.consumption.length === 0) {
		return;
	}

	const guild = await Guilds.getById(guildId);
	if (!guild) {
		return;
	}

	for (const item of plan.consumption) {
		guild[item.foodType] -= item.itemsToConsume;
	}

	await guild.save();
}

/**
 * Calculate total available rations in a guild for a specific pet's diet
 */
export function calculateTotalAvailableRations(guild: Guild, petModel: Pet): number {
	const dietType = getDietFoodType(petModel);
	return guild.commonFood * FOOD_CONFIG_MAP.commonFood.rations
		+ guild[dietType] * FOOD_CONFIG_MAP[dietType].rations
		+ guild.ultimateFood * FOOD_CONFIG_MAP.ultimateFood.rations;
}
