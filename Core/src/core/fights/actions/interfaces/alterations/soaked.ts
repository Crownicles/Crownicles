import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import {
	FightActionController
} from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightAlterationFunc = (affected, fightAlteration, _opponent) => {
	// 40% chance to be healed from the soaked (except for the first turn)
	if (RandomUtils.crowniclesRandom.bool(0.4) && affected.alterationTurn > 1) {
		affected.removeSpeedModifiers(fightAlteration);
		affected.removeDefenseModifiers(fightAlteration);
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();
	result.state = FightAlterationState.ACTIVE;
	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.6
		}, affected, fightAlteration);
	}

	if (!affected.hasDefenseModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.85
		}, affected, fightAlteration);
	}
	return result;
};

export default use;
