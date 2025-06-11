import { FightActionController } from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { customMessageActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightAlterations } from "../../FightAlterations";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, _receiver, _fightAction) => {
	const result = customMessageActionResult();

	// 85% chance to be dirty
	if (RandomUtils.crowniclesRandom.bool(0.85)) {
		FightActionController.applyAlteration(result, {
			selfTarget: true,
			alteration: FightAlterations.DIRTY
		}, sender);
	}
	else { // 15% chance to be poisoned
		FightActionController.applyAlteration(result, {
			selfTarget: true,
			alteration: FightAlterations.POISONED
		}, sender);
	}
	return result;
};

export default use;
