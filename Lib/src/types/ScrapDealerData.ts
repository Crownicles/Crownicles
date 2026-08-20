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
};
