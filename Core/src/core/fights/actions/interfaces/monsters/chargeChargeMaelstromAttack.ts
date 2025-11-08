import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import {
	customMessageActionResult,
	defaultMaxUsesFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = sender => {
	const count = sender.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.MONSTER.MAELSTROM_ATTACK).length;
	if (count >= 1) {
		return defaultMaxUsesFightActionResult();
	}
	sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.MONSTER.CHARGE_MAELSTROM_ATTACK);
	return customMessageActionResult();
};

export default use;
