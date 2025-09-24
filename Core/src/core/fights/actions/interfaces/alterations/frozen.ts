import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { Fighter } from "../../../fighter/Fighter";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { FightAlterations } from "../../FightAlterations";

const use: FightAlterationFunc = (affected, fightAlteration, opponent) => {
	if (
		affected.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.FIRE_ATTACK
		&& affected.alterationTurn > 1
	) {
		return defaultHealFightAlterationResult(affected);
	}

	// 50% chance to be healed from the frozen (except for the first two turns)
	if (RandomUtils.crowniclesRandom.bool() && affected.alterationTurn > 2) {
		affected.removeSpeedModifiers(fightAlteration);
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();
	result.state = FightAlterationState.ACTIVE;
	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.4
		}, affected, fightAlteration);
	}
	result.damages = FightActionController.getAttackDamage(getStatsInfo(affected, opponent), affected, getAttackInfo(), true);

	if (result.damages) {
		result.damages *= opponent.getAlterationMultiplier(FightAlterations.FROZEN); // Apply alteration multiplier
	}

	return result;
};

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 45,
		maxDamage: 80
	};
}

function getStatsInfo(affected: Fighter, _opponent: Fighter): statsInfo {
	return {
		attackerStats: [affected.getMaxBreath() * 40],
		defenderStats: [affected.getBreath() * 80],
		statsEffect: [1]
	};
}

export default use;
