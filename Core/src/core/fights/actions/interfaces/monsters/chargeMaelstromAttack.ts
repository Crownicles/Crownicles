import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { customMessageActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = sender => {
	sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.MONSTER.MAELSTROM_ATTACK);
	return customMessageActionResult();
};

export default use;
