import {
	FightActionController
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightActionDataController } from "../../../../../data/FightAction";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const turnsToHeal = 2;


const use: FightAlterationFunc = (affected, fightAlteration, _opponent, _turn) => {
	const result = defaultFightAlterationResult();

	if (affected.alterationTurn > turnsToHeal) {
		affected.removeSpeedModifiers(fightAlteration);
		if (RandomUtils.crowniclesRandom.bool(0.6)) {
			affected.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.GET_SOAKED);
			return defaultHealFightAlterationResult(affected);
		}
		return defaultHealFightAlterationResult(affected);
	}

	result.state = FightAlterationState.ACTIVE;
	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.4
		}, affected, fightAlteration);
	}

	if (affected.getBreath() >= 1) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.BREATH,
			operator: FightStatModifierOperation.ADDITION,
			value: affected.getBreath() > 1 ? -2 : -1
		}, affected, fightAlteration);
	}

	return result;
};

export default use;

