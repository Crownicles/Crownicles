import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import {
	customMessageActionResult, defaultFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { MonsterFighter } from "../../../fighter/MonsterFighter";

const use: FightActionFunc = (sender, receiver, _fightAction, turn, fight) => {
	const lastAttack = receiver.getLastFightActionUsed();
	if (!lastAttack || FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastAttack.id)) {
		return {
			...customMessageActionResult(),
			damages: 0
		};
	}
	const launchedResult = FightActionDataController.getFightActionFunction(lastAttack.id)!(sender, receiver, lastAttack, turn, fight);
	if (receiver instanceof MonsterFighter && launchedResult.damages) {
		launchedResult.damages = Math.round(launchedResult.damages * FightConstants.COUNTER_ATTACK_MONSTER_DAMAGE_MULTIPLIER);
	}
	const result = defaultFightActionResult();
	result.usedAction = {
		id: lastAttack.id,
		result: launchedResult
	};
	result.usedAction.result.customMessage = false;
	return result;
};

export default use;
