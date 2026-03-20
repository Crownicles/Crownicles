import { WitchActionFuncs } from "../../../data/WitchAction";
import { ItemRarity } from "../../../../../Lib/src/constants/ItemConstants";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		maxRarity: ItemRarity.LEGENDARY
	})
};
