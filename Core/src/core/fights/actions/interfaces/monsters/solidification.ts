import { FightActionFunc } from "../../../../../data/FightAction";
import { defaultFightActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionController } from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";


const use: FightActionFunc = (sender, _receiver, _fightAction) => {
	const result = defaultFightActionResult();
	FightActionController.applyResistance(result, {
		selfTarget: true,
		type: FightActionType.PHYSICAL,
		value: 0.7,
		duration: 1,
		reflectDamage: true
	}, sender);
	return {
		...result,
		customMessage: true
	};
};

export default use;
