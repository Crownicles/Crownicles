import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import {
	defaultFailFightActionResult,
	defaultFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = (sender, receiver, _fightAction, turn, fight) => {
	const lastAttack = receiver.getLastFightActionUsed();

	if (!lastAttack) {
		return defaultFailFightActionResult();
	}

	const attackToUse = lastAttack.type === FightActionType.MAGIC ? lastAttack.id : FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK;
	const launchedResult = FightActionDataController.getFightActionFunction(attackToUse)!(sender, receiver, lastAttack, turn, fight);
	const result = defaultFightActionResult();
	result.usedAction = {
		id: attackToUse,
		result: launchedResult
	};
	return result;
};

export default use;
