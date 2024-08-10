import {WitchActionFuncs} from "../../../data/WitchAction";
import {ItemNature, ItemRarity} from "../../../../../Lib/src/constants/ItemConstants";
import {RandomUtils} from "../../../../../Lib/src/utils/RandomUtils";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		minRarity: ItemRarity.RARE,
		maxRarity: ItemRarity.SPECIAL,
		nature: RandomUtils.draftbotRandom.bool(0.625) ? ItemNature.SPEED : ItemNature.TIME_SPEEDUP
	})
};
