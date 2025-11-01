import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: FightAlterationFunc = (affected, fightAlteration, opponent) => {
	if (RandomUtils.crowniclesRandom.bool(0.1) && affected.alterationTurn === 3 || RandomUtils.crowniclesRandom.bool(0.7) && affected.alterationTurn > 2) {
		affected.removeSpeedModifiers(fightAlteration);
		affected.removeAttackModifiers(fightAlteration);
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();
	result.state = FightAlterationState.ACTIVE;

	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 1.5
		}, affected, fightAlteration);
	}

	if (!affected.hasAttackModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ATTACK,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 2
		}, affected, fightAlteration);
	}

	result.damages = FightActionController.getAttackDamage(getStatsInfo(affected, opponent), affected, getAttackInfo(), true);
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 70,
		maxDamage: 90
	};
}

function getStatsInfo(affected: Fighter, opponent: Fighter): statsInfo {
	return {
		attackerStats: [opponent.getAttack()],
		defenderStats: [affected.getDefense() / 4],
		statsEffect: [1]
	};
}
