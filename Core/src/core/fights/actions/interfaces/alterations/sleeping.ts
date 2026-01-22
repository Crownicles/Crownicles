import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	attackInfo,
	FightActionController,
	statsInfo
} from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionDataController } from "../../../../../data/FightAction";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	defaultFightAlterationResult,
	defaultHealFightAlterationResult
} from "../../../FightController";
import { Fighter } from "../../../fighter/Fighter";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightAlterationFunc = (affected, fightAlteration) => {
	if (affected.alterationTurn > 3 || RandomUtils.crowniclesRandom.bool(0.35)) { // This effect heals after 3 turns
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();
	result.state = FightAlterationState.ACTIVE;
	const recoveredEnergy = Math.round(FightActionController.getAttackDamage(getStatsInfo(affected), affected, getAttackInfo(), true));


	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: recoveredEnergy
	}, affected, fightAlteration);

	affected.nextFightAction = FightActionDataController.instance.getNone();
	return result;
};

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 20,
		maxDamage: 110
	};
}

function getStatsInfo(sender: Fighter): statsInfo {
	return {
		attackerStats: [sender.getMaxEnergy()],
		defenderStats: [sender.getEnergy()],
		statsEffect: [1]
	};
}

export default use;
