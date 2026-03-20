import { FightActionFunc } from "../../../../../data/FightAction";
import {
	defaultFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionController } from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";

const use: FightActionFunc = (sender, _receiver, _fightAction) => {
	const result = defaultFightActionResult();

	// The kraken wraps its tentacles around itself, absorbing 60% of distance damage for 2 player turns
	FightActionController.applyResistance(result, {
		selfTarget: true,
		type: FightActionType.DISTANCE,
		value: 0.6,
		duration: 1,
		reflectDamage: true
	}, sender);
	return {
		...result,
		customMessage: true
	};
};

export default use;
