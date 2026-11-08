import { PetFood } from "./PetFood";
import { PlantId } from "./PlantId";

export enum RecipeType {
	POTION_HEALTH = "POTION_HEALTH",
	POTION_ENERGY = "POTION_ENERGY",
	POTION_TIME_SPEEDUP = "POTION_TIME_SPEEDUP",
	POTION_DEFENSE = "POTION_DEFENSE",
	POTION_ATTACK = "POTION_ATTACK",
	POTION_SPEED = "POTION_SPEED",
	PETFOOD_SALAD = "PETFOOD_SALAD",
	PETFOOD_CANDY = "PETFOOD_CANDY",
	PETFOOD_MEAT = "PETFOOD_MEAT",
	PETFOOD_ULTIMATE = "PETFOOD_ULTIMATE",
	MATERIAL_CRAFT = "MATERIAL_CRAFT"
}
export const CookingOutputType = {
	POTION: "potion", PET_FOOD: "petFood", MATERIAL: "material"
} as const;
export type CookingOutput = typeof CookingOutputType[keyof typeof CookingOutputType];
export const CookingCraftErrors = {
	CRAFT_UNAVAILABLE: "craftUnavailable",
	INVENTORY_FULL: "inventoryFull",
	GUILD_REQUIRED: "guildRequired",
	GUILD_STORAGE_FULL: "guildStorageFull",
	TIME_POTION_WEEKLY_LIMIT: "timePotionWeeklyLimit"
} as const;
export type CookingCraftError = typeof CookingCraftErrors[keyof typeof CookingCraftErrors];
export const CookingSpecialtyErrors = {
	LIMIT_REACHED: "specialtyLimitReached",
	UNAVAILABLE: "specialtyUnavailable"
} as const;
export type CookingSpecialtyError = typeof CookingSpecialtyErrors[keyof typeof CookingSpecialtyErrors];
export type RecipeIngredients = {
	plants: {
		plantId: PlantId; quantity: number; playerHas: number;
	}[];
	materials: {
		materialId: number; quantity: number; playerHas: number;
	}[];
};
export type RecipeDisplayInfo = {
	recipeId: string; level: number; recipeType: RecipeType;
};
export type PinnedRecipeInfo = RecipeDisplayInfo & {
	outputType: CookingOutput; ingredients: RecipeIngredients; canCraft: boolean;
};

/** A recipe the master chef made one of their specialties, offered on the specialty station at every ignition. */
export type CookingSpecialty = RecipeDisplayInfo & { canCraft: boolean };

/** Core's cooking limits the menu explains, read by RestWs from Lib rather than copied into the app. */
export type CookingRules = {

	/** The station offering the specialties, after the rotating ones. */
	specialtyStation: number;

	/** Specialties the cook's level allows, 0 until the first one is unlocked. */
	specialtyLimit: number;

	/** Cooking level unlocking one more specialty, omitted once they are all unlocked. */
	nextSpecialtyLevel?: number;

	/** The time potions left this week are only told once this many or fewer remain. */
	timePotionsShownFrom: number;
};
export type CookingSlot = {
	slotIndex: number;
	recipe: {
		id: string;
		level: number;
		isSecret: boolean;
		outputDescription: string;
		outputType: CookingOutput;
		recipeType: RecipeType;
		petFoodType?: PetFood;
		ingredients: RecipeIngredients;
		canCraft: boolean;

		/** Time potions the player can still cook this week, only set on time potion recipes. */
		timePotionsLeftThisWeek?: number;
	} | null;
};
export type CookingMenu = {
	cookingLevel: number;
	cookingGrade: string;
	pinnedRecipe?: PinnedRecipeInfo;

	/** Omitted while the player has no specialty. */
	specialties?: CookingSpecialty[];
	currentSlots: CookingSlot[];
	isIgnited: boolean;
	rules: CookingRules;
};
export type CraftResult = {
	success: boolean;
	recipeId: string;
	wasSecret: boolean;
	outputType: CookingOutput;
	potionId?: number;
	petFood?: {
		type: PetFood; quantity: number; storedQuantity: number; fedFromSurplus?: boolean; surplusMaterialId?: number; surplusMaterialQuantity?: number;
	};
	material?: {
		materialId: number; quantity: number;
	};
	failedPotionId?: number;
	cookingXpGained: number;
	cookingLevelUp: boolean;
	newCookingLevel?: number;
	newCookingGrade?: string;
	masterChefBadgeEarned?: boolean;
	materialSaved?: number;
	bonusOutput?: boolean;
	discoveredRecipes?: RecipeDisplayInfo[];
	error?: CookingCraftError;
	menu: CookingMenu;
};
export type CookingOutcome =
	| {
		kind: "menu"; menu: CookingMenu;
	}
	| {
		kind: "furnace"; menu: CookingMenu; woodConsumed: boolean; woodMaterialId: number;
	}
	| {
		kind: "woodConfirmation"; woodMaterialId: number; woodRarity: number;
	}
	| { kind: "noWood" | "unavailable" }
	| {
		kind: "crafted"; result: CraftResult;
	}
	| {
		kind: "specialtyChosen"; menu: CookingMenu; error?: CookingSpecialtyError;
	}
	| {
		kind: "specialtyRemoved"; menu: CookingMenu;
	};
