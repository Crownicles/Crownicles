import {
	SLOT_CONFIGS, SLOT_SEED_OFFSETS, RecipeType, SlotConfig, MIN_GUARANTEED_PLAYER_LEVEL_RECIPES, CookingOutputType
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CookingRecipeDataController } from "../../data/CookingRecipeData";

// Hash mixing primes for deterministic seed derivation
const CANDIDATE_INDEX_PRIMES = {
	DAY: 7,
	FURNACE: 13,
	SLOT: 97
} as const;

const SECRET_SEED_PRIMES = {
	DAY: 11,
	FURNACE: 23,
	SLOT: 131
} as const;

// LCG (Linear Congruential Generator) constants for pseudo-random generation
const LCG = {
	MULTIPLIER: 1103515245,
	INCREMENT: 12345,
	MAX_VALUE: 0x7fffffff
} as const;

interface SlotRecipeSelectionOptions {
	slotIndex: number;
	furnacePosition: number;
	daySeed: number;
	discoveredRecipeIds: string[];
	excludedRecipeIds: ReadonlySet<string>;
	allowPetFoodRecipes?: boolean;
	maxRecipeLevel?: number;
}

interface UniqueSlotRecipesOptions {
	cookingSlots: number;
	furnacePosition: number;
	daySeed: number;
	discoveredRecipeIds: string[];
	allowPetFoodRecipes?: boolean;
	maxRecipeLevelWithoutPenalty?: number;
}

/**
 * Get the ordered cycle of recipe types for a given slot on a given day
 */
export function getSlotCycle(slotIndex: number, daySeed: number): RecipeType[] {
	const config = SLOT_CONFIGS[slotIndex];
	const slotSeed = daySeed + SLOT_SEED_OFFSETS[slotIndex];
	return RandomUtils.deterministicShuffle([...config.eligibleTypes], slotSeed);
}

interface CandidateFilterOptions {
	slotIndex: number;
	recipeType: RecipeType;
	discoveredRecipeIds: string[];
	allowPetFoodRecipes: boolean;
	maxLevelOverride?: number;
}

function getCandidatesForSlotType({
	slotIndex,
	recipeType,
	discoveredRecipeIds,
	allowPetFoodRecipes,
	maxLevelOverride
}: CandidateFilterOptions): CookingRecipe[] {
	const slotConfig: SlotConfig = SLOT_CONFIGS[slotIndex];
	const effectiveMaxLevel = maxLevelOverride !== undefined
		? Math.min(maxLevelOverride, slotConfig.maxLevel)
		: slotConfig.maxLevel;
	return CookingRecipeDataController.instance
		.getByTypeAndLevelRange(recipeType, slotConfig.minLevel, effectiveMaxLevel)
		.filter(recipe => (recipe.discoveredByDefault || discoveredRecipeIds.includes(recipe.id))
			&& (allowPetFoodRecipes || recipe.outputType !== CookingOutputType.PET_FOOD));
}

interface BaseCandidateIndexOptions {
	slotIndex: number;
	furnacePosition: number;
	daySeed: number;
	candidatesLength: number;
}

function getBaseCandidateIndex({
	slotIndex,
	furnacePosition,
	daySeed,
	candidatesLength
}: BaseCandidateIndexOptions): number {
	const tierSeed = daySeed * CANDIDATE_INDEX_PRIMES.DAY + furnacePosition * CANDIDATE_INDEX_PRIMES.FURNACE + slotIndex * CANDIDATE_INDEX_PRIMES.SLOT;
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
	allowPetFoodRecipes = true,
	maxRecipeLevel
}: SlotRecipeSelectionOptions): CookingRecipe | null {
	const cycle = getSlotCycle(slotIndex, daySeed);
	const startTypeIndex = furnacePosition % cycle.length;

	// Try each type in the cycle starting from the current rotation position
	for (let offset = 0; offset < cycle.length; offset++) {
		const recipeType = cycle[(startTypeIndex + offset) % cycle.length];
		const candidates = getCandidatesForSlotType({
			slotIndex,
			recipeType,
			discoveredRecipeIds,
			allowPetFoodRecipes,
			maxLevelOverride: maxRecipeLevel
		});

		if (candidates.length === 0) {
			continue;
		}

		const baseIndex = getBaseCandidateIndex({
			slotIndex,
			furnacePosition,
			daySeed,
			candidatesLength: candidates.length
		});
		const recipe = pickCandidateWithoutDuplicates(candidates, baseIndex, excludedRecipeIds);
		if (recipe) {
			return recipe;
		}
	}

	return null;
}

interface GuaranteePlayerLevelRecipesOptions {
	recipes: Array<CookingRecipe | null>;
	usedRecipeIds: Set<string>;
	slotCount: number;
	maxRecipeLevelWithoutPenalty: number | undefined;
	baseOptions: Pick<SlotRecipeSelectionOptions, "furnacePosition" | "daySeed" | "discoveredRecipeIds" | "allowPetFoodRecipes">;
}

function guaranteePlayerLevelRecipes({
	recipes,
	usedRecipeIds,
	slotCount,
	maxRecipeLevelWithoutPenalty,
	baseOptions
}: GuaranteePlayerLevelRecipesOptions): void {
	if (maxRecipeLevelWithoutPenalty === undefined) {
		return;
	}
	let guaranteed = 0;
	for (let slotIndex = 0; slotIndex < slotCount && guaranteed < MIN_GUARANTEED_PLAYER_LEVEL_RECIPES; slotIndex++) {
		if (SLOT_CONFIGS[slotIndex].minLevel > maxRecipeLevelWithoutPenalty) {
			continue;
		}

		const recipe = getRecipeForSlotExcluding({
			slotIndex,
			...baseOptions,
			excludedRecipeIds: usedRecipeIds,
			maxRecipeLevel: maxRecipeLevelWithoutPenalty
		});

		if (recipe) {
			recipes[slotIndex] = recipe;
			usedRecipeIds.add(recipe.id);
			guaranteed++;
		}
	}
}

export function getUniqueRecipesForSlots({
	cookingSlots,
	furnacePosition,
	daySeed,
	discoveredRecipeIds,
	allowPetFoodRecipes = true,
	maxRecipeLevelWithoutPenalty
}: UniqueSlotRecipesOptions): Array<CookingRecipe | null> {
	const slotCount = Math.min(cookingSlots, SLOT_CONFIGS.length);
	const recipes: Array<CookingRecipe | null> = new Array(slotCount).fill(null);
	const usedRecipeIds = new Set<string>();

	const baseOptions = {
		furnacePosition,
		daySeed,
		discoveredRecipeIds,
		allowPetFoodRecipes
	};

	// Pass 1: guarantee player-level recipes in eligible slots
	guaranteePlayerLevelRecipes({
		recipes, usedRecipeIds, slotCount, maxRecipeLevelWithoutPenalty, baseOptions
	});

	// Pass 2: normal selection for remaining slots
	for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
		if (recipes[slotIndex] !== null) {
			continue;
		}

		const recipe = getRecipeForSlotExcluding({
			slotIndex,
			...baseOptions,
			excludedRecipeIds: usedRecipeIds
		});

		recipes[slotIndex] = recipe;
		if (recipe) {
			usedRecipeIds.add(recipe.id);
		}
	}

	return recipes;
}

interface RecipeSecretOptions {
	slotIndex: number;
	furnacePosition: number;
	daySeed: number;
	secretRate: number;
}

/**
 * Determine if a recipe in a slot should be secret (output hidden)
 */
export function isRecipeSecret({
	slotIndex,
	furnacePosition,
	daySeed,
	secretRate
}: RecipeSecretOptions): boolean {
	const secretSeed = daySeed * SECRET_SEED_PRIMES.DAY + furnacePosition * SECRET_SEED_PRIMES.FURNACE + slotIndex * SECRET_SEED_PRIMES.SLOT;
	const pseudoRandom = ((secretSeed * LCG.MULTIPLIER + LCG.INCREMENT) & LCG.MAX_VALUE) / LCG.MAX_VALUE;
	return pseudoRandom < secretRate;
}

/**
 * Get the current day seed (changes daily)
 */
export function getCurrentDaySeed(): number {
	return getDayNumber();
}
