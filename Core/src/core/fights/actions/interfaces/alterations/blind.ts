import { FightActionController } from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultFightAlterationResult,
	defaultHealFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightActionDataController } from "../../../../../data/FightAction";

const use: FightAlterationFunc = (affected, fightAlteration, _opponent) => {
	// 90 % chance to be healed
	if (RandomUtils.crowniclesRandom.bool(0.9) && affected.alterationTurn > 1) {
		affected.removeDefenseModifiers(fightAlteration);
		affected.removeSpeedModifiers(fightAlteration);
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();

	result.state = FightAlterationState.ACTIVE;
	if (!affected.hasDefenseModifier(fightAlteration)) {
		result.state = FightAlterationState.NEW;
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.8
		}, affected, fightAlteration);
	}

	if (!affected.hasSpeedModifier(fightAlteration)) {
		result.state = FightAlterationState.NEW;
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.3
		}, affected, fightAlteration);
	}

	// 80% chance of not being able to attack this turn
	if (RandomUtils.crowniclesRandom.bool(0.8)) {
		affected.nextFightAction = FightActionDataController.instance.getNone();
		result.state = FightAlterationState.NO_ACTION;
	}

	return result;
};

export default use;
