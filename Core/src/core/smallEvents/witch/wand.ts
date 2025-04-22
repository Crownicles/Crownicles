import { WitchActionFuncs } from "../../../data/WitchAction";
import { ItemRarity } from "../../../../../Lib/src/constants/ItemConstants";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		minRarity: ItemRarity.RARE,
		maxRarity: ItemRarity.EPIC
	})
};
