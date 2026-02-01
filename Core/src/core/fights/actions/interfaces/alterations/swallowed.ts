import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { defaultHealFightAlterationResult } from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionDataController } from "../../../../../data/FightAction";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightAlterationFunc = (affected, _fightAlteration, _opponent) => {
	// 50 % chance to be spitted from the front door on turn 2
	if (RandomUtils.crowniclesRandom.bool(0.5) && affected.alterationTurn === 2) {
		return defaultHealFightAlterationResult(affected);
	}

	if (affected.alterationTurn < 2) {
		affected.nextFightAction = FightActionDataController.instance.getNone() ?? null;
		return {
			state: FightAlterationState.NO_ACTION
		};
	}

	// Turn 3, fighter made it to the back door
	affected.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.GET_DIRTY) ?? null;
	return defaultHealFightAlterationResult(affected);
};

export default use;
