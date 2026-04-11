import { FightActionFunc } from "../../../../../data/FightAction";
import {
	defaultFightActionResult,
	defaultMaxUsesFightActionResult,
	FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionController } from "../../FightActionController";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const MAX_USES = 2;

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const useCount = sender.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.MONSTER.ABYSSAL_AURA).length;
	if (useCount >= MAX_USES) {
		return defaultMaxUsesFightActionResult();
	}

	const result = defaultFightActionResult();
	FightActionController.applyBuff(result, {
		selfTarget: false,
		stat: FightStatBuffed.BREATH_REGEN,
		operator: FightStatModifierOperation.ADDITION,
		value: -1,
		duration: 3
	}, receiver, fightAction);

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.DAMAGE_BOOST,
		operator: FightStatModifierOperation.ADDITION,
		value: 1.5,
		duration: 2
	}, receiver, fightAction);

	return {
		...result,
		customMessage: true
	};
};

export default use;
