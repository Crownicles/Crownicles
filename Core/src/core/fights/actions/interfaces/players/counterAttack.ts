import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import {
	customMessageActionResult, defaultFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";

const use: FightActionFunc = (sender, receiver, _fightAction, turn, fight) => {
	const lastAttack = receiver.getLastFightActionUsed();
	if (!lastAttack || FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastAttack.id)) {
		return {
			...customMessageActionResult(),
			damages: 0
		};
	}
	const launchedResult = FightActionDataController.getFightActionFunction(lastAttack.id)!(sender, receiver, lastAttack, turn, fight);
	const result = defaultFightActionResult();
	result.usedAction = {
		id: lastAttack.id,
		result: launchedResult
	};
	result.usedAction.result.customMessage = false;
	return result;
};

export default use;
