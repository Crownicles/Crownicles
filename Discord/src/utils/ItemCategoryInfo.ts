import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ChestSlotsPerCategory } from "../../../Lib/src/types/HomeFeatures";

/**
 * Info about an item category, used for building category-based menus.
 */
export interface CategoryInfo {
	category: ItemCategory;
	translationKey: string;
}

/**
 * Extended category info including the key into ChestSlotsPerCategory.
 */
export interface ChestCategoryInfo extends CategoryInfo {
	key: keyof ChestSlotsPerCategory;
}

/**
 * Base category info used by equip and chest menus.
 */
export const CATEGORY_INFO: ChestCategoryInfo[] = [
	{
		key: "weapon", category: ItemCategory.WEAPON, translationKey: "weapons"
	},
	{
		key: "armor", category: ItemCategory.ARMOR, translationKey: "armors"
	},
	{
		key: "potion", category: ItemCategory.POTION, translationKey: "potions"
	},
	{
		key: "object", category: ItemCategory.OBJECT, translationKey: "objects"
	}
];
