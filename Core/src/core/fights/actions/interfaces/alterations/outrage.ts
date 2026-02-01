import {
	FightAlterationDataController, FightAlterationFunc
} from "../../../../../data/FightAlteration";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightAlterations } from "../../FightAlterations";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";

const use: FightAlterationFunc = (affected, fightAlteration) => {
	if (affected.alterationTurn > 2) { // This effect heals after two turns
		affected.removeAttackModifiers(fightAlteration);
		affected.removeSpeedModifiers(fightAlteration);
		const result = defaultHealFightAlterationResult(affected);
		affected.newAlteration(FightAlterationDataController.instance.getById(FightAlterations.STUNNED)!);
		return result;
	}
	const result = defaultFightAlterationResult();
	if (!affected.hasAttackModifier(fightAlteration)) {
		result.state = FightAlterationState.NEW;
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ATTACK,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 2
		}, affected, fightAlteration);
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.25
		}, affected, fightAlteration);
	}
	return result;
};

export default use;
