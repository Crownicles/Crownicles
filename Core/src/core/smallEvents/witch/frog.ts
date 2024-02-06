import {WitchActionFuncs} from "../../../data/WitchAction";
import {ItemNature, ItemRarity} from "../../../../../Lib/src/constants/ItemConstants";
import {RandomUtils} from "../../utils/RandomUtils";

export const witchSmallEvent: WitchActionFuncs = {
	generatePotion: () => ({
		minRarity: ItemRarity.RARE,
		maxRarity: ItemRarity.RARE,
		nature: RandomUtils.draftbotRandom.bool() ? ItemNature.SPEED : ItemNature.TIME_SPEEDUP
	})
};
