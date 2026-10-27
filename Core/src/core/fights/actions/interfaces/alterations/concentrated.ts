import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";

const use: FightAlterationFunc = (affected, fightAlteration) => {
	if (affected.alterationTurn > 1) { // This effect only lasts one turn
		return defaultHealFightAlterationResult(affected);
	}
	const result = defaultFightAlterationResult();
	if (!affected.hasAttackModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DAMAGE_BOOST,
			operator: FightStatModifierOperation.MULTIPLIER,
			duration: 1,
			value: 1.7
		}, affected, fightAlteration);
		result.state = FightAlterationState.NEW;
	}
	return result;
};

export default use;
