import { Fighter } from "../../../fighter/Fighter";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { defaultFightActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = (sender: Fighter) => {
	// Set the next fight action of the sender to be the club smash attack
	sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.MONSTER.CLUB_SMASH_ATTACK) ?? null;
	return defaultFightActionResult();
};

export default use;
