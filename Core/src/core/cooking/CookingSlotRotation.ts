import {
	SLOT_CONFIGS, SLOT_SEED_OFFSETS, RecipeType, SlotConfig
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import { recipeRegistry } from "./RecipeRegistry";

/**
 * Deterministic Fisher-Yates shuffle using a simple LCG seeded PRNG
 */
function deterministicShuffle<T>(array: T[], seed: number): T[] {
	const result = [...array];
	let s = Math.abs(seed) | 1;
	for (let i = result.length - 1; i > 0; i--) {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		const j = s % (i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Get the ordered cycle of recipe types for a given slot on a given day
 */
export function getSlotCycle(slotIndex: number, daySeed: number): RecipeType[] {
	const config = SLOT_CONFIGS[slotIndex];
	const slotSeed = daySeed + SLOT_SEED_OFFSETS[slotIndex];
	return deterministicShuffle([...config.eligibleTypes], slotSeed);
}

/**
 * Determine which recipe should appear in a slot at a given furnace position
 */
export function getRecipeForSlot(
	slotIndex: number,
	furnacePosition: number,
	daySeed: number,
	discoveredRecipeIds: string[]
): CookingRecipe | null {
	const cycle = getSlotCycle(slotIndex, daySeed);
	const typeIndex = furnacePosition % cycle.length;
	const recipeType = cycle[typeIndex];

	const slotConfig: SlotConfig = SLOT_CONFIGS[slotIndex];
	const candidates = recipeRegistry
		.getByTypeAndLevelRange(recipeType, slotConfig.minLevel, slotConfig.maxLevel)
		.filter(r => r.discoveredByDefault || discoveredRecipeIds.includes(r.id));

	if (candidates.length === 0) {
		return null;
	}

	// Deterministic tier selection
	const tierSeed = daySeed * 7 + furnacePosition * 13 + slotIndex * 97;
	const tierIndex = Math.abs(tierSeed) % candidates.length;
	return candidates[tierIndex];
}

/**
 * Determine if a recipe in a slot should be secret (output hidden)
 */
export function isRecipeSecret(
	slotIndex: number,
	furnacePosition: number,
	daySeed: number,
	secretRate: number
): boolean {
	const secretSeed = daySeed * 11 + furnacePosition * 23 + slotIndex * 131;
	const pseudoRandom = ((secretSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
	return pseudoRandom < secretRate;
}

/**
 * Get the current day seed (changes daily)
 */
export function getCurrentDaySeed(): number {
	return getDayNumber();
}
