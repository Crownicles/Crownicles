import {WitchActionFuncs} from "../../../data/WitchAction";
import {ItemNature, ItemRarity} from "../../constants/ItemConstants";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		minRarity: ItemRarity.RARE,
		maxRarity: ItemRarity.RARE,
		nature: ItemNature.TIME_SPEEDUP
	})
};
