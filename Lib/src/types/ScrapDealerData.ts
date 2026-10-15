import { ItemCategory } from "../constants/ItemConstants";
import { MainItemDetails } from "./MainItemDetails";
import { MaterialQuantity } from "./MaterialQuantity";

export type ScrapDealerItem = {
	slot: number;
	category: ItemCategory;
	itemId: number;
	details: MainItemDetails;
	recoveredMaterials: MaterialQuantity[];
	recoveredMoney: number;
};

export type ScrapDealerData = {
	recyclableItems: ScrapDealerItem[];

	/** Reserve weapons and armors the scrap dealer refuses until their enchantment is removed at the blacksmith. */
	enchantedItems: Omit<ScrapDealerItem, "recoveredMaterials" | "recoveredMoney">[];
};
