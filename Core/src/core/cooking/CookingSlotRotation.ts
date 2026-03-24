import {
	SLOT_CONFIGS, SLOT_SEED_OFFSETS, RecipeType, SlotConfig
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import { recipeRegistry } from "./RecipeRegistry";

interface SlotRecipeSelectionOptions {
	slotIndex: number;
	furnacePosition: number;
	daySeed: number;
	discoveredRecipeIds: string[];
	excludedRecipeIds: ReadonlySet<string>;
	allowPetFoodRecipes?: boolean;
}

interface UniqueSlotRecipesOptions {
	cookingSlots: number;
	furnacePosition: number;
	daySeed: number;
	discoveredRecipeIds: string[];
	allowPetFoodRecipes?: boolean;
}

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

function getCandidatesForSlotType(
	slotIndex: number,
	recipeType: RecipeType,
	discoveredRecipeIds: string[],
	allowPetFoodRecipes: boolean
): CookingRecipe[] {
	const slotConfig: SlotConfig = SLOT_CONFIGS[slotIndex];
	return recipeRegistry
		.getByTypeAndLevelRange(recipeType, slotConfig.minLevel, slotConfig.maxLevel)
		.filter(recipe => (recipe.discoveredByDefault || discoveredRecipeIds.includes(recipe.id))
			&& (allowPetFoodRecipes || recipe.outputType !== "petFood"));
}

function getBaseCandidateIndex(
	slotIndex: number,
	furnacePosition: number,
	daySeed: number,
	candidatesLength: number
): number {
	const tierSeed = daySeed * 7 + furnacePosition * 13 + slotIndex * 97;
	return Math.abs(tierSeed) % candidatesLength;
}

function pickCandidateWithoutDuplicates(
	candidates: CookingRecipe[],
	baseIndex: number,
	excludedRecipeIds: ReadonlySet<string>
): CookingRecipe | null {
	for (let offset = 0; offset < candidates.length; offset++) {
		const candidate = candidates[(baseIndex + offset) % candidates.length];
		if (!excludedRecipeIds.has(candidate.id)) {
			return candidate;
		}
	}

	return null;
}

export function getRecipeForSlotExcluding({
	slotIndex,
	furnacePosition,
	daySeed,
	discoveredRecipeIds,
	excludedRecipeIds,
	allowPetFoodRecipes = true
}: SlotRecipeSelectionOptions): CookingRecipe | null {
	const cycle = getSlotCycle(slotIndex, daySeed);
	const startTypeIndex = furnacePosition % cycle.length;

	// Try each type in the cycle starting from the current rotation position
	for (let offset = 0; offset < cycle.length; offset++) {
		const recipeType = cycle[(startTypeIndex + offset) % cycle.length];
		const candidates = getCandidatesForSlotType(slotIndex, recipeType, discoveredRecipeIds, allowPetFoodRecipes);

		if (candidates.length === 0) {
			continue;
		}

		const baseIndex = getBaseCandidateIndex(slotIndex, furnacePosition, daySeed, candidates.length);
		const recipe = pickCandidateWithoutDuplicates(candidates, baseIndex, excludedRecipeIds);
		if (recipe) {
			return recipe;
		}
	}

	return null;
}

export function getUniqueRecipesForSlots({
	cookingSlots,
	furnacePosition,
	daySeed,
	discoveredRecipeIds,
	allowPetFoodRecipes = true
}: UniqueSlotRecipesOptions): Array<CookingRecipe | null> {
	const recipes: Array<CookingRecipe | null> = [];
	const usedRecipeIds = new Set<string>();

	for (let slotIndex = 0; slotIndex < cookingSlots && slotIndex < SLOT_CONFIGS.length; slotIndex++) {
		const recipe = getRecipeForSlotExcluding({
			slotIndex,
			furnacePosition,
			daySeed,
			discoveredRecipeIds,
			excludedRecipeIds: usedRecipeIds,
			allowPetFoodRecipes
		});

		recipes.push(recipe);
		if (recipe) {
			usedRecipeIds.add(recipe.id);
		}
	}

	return recipes;
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
	return getRecipeForSlotExcluding({
		slotIndex,
		furnacePosition,
		daySeed,
		discoveredRecipeIds,
		excludedRecipeIds: new Set<string>()
	});
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
