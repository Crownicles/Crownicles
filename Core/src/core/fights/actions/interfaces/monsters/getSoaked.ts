import { FightActionController } from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { customMessageActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightAlterations } from "../../FightAlterations";

const use: FightActionFunc = (sender, _receiver, _fightAction) => {
	const result = customMessageActionResult();

	FightActionController.applyAlteration(result, {
		selfTarget: true,
		alteration: FightAlterations.SOAKED
	}, sender);

	return result;
};

export default use;
