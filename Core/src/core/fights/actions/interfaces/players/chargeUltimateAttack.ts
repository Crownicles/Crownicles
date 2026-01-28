import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { fightActionResultFromSuccessTest } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = sender => {
	const usedUltimateAttacks = sender.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.PLAYER.ULTIMATE_ATTACK).length;
	if (usedUltimateAttacks === 0) {
		// Set the next fight action of the sender to be the ultimate attack
		sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.ULTIMATE_ATTACK) ?? null;
	}
	return fightActionResultFromSuccessTest(usedUltimateAttacks === 0);
};

export default use;
