import { WitchActionFuncs } from "../../../data/WitchAction";
import {
	ItemNature,
	ItemRarity
} from "../../../../../Lib/src/constants/ItemConstants";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		minRarity: ItemRarity.SPECIAL,
		maxRarity: ItemRarity.EPIC,
		subType: ItemNature.ATTACK
	})
};
