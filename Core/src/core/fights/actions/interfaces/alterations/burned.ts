import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultDamageFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightAlterations } from "../../FightAlterations";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	// 10 % chance to be healed from the burn on turn 2 or 80 % chance on turn 3 and later
	if (RandomUtils.crowniclesRandom.bool(0.1) && affected.alterationTurn === 2 || RandomUtils.crowniclesRandom.bool(0.8) && affected.alterationTurn > 2) {
		return defaultHealFightAlterationResult(affected);
	}

	const burn = defaultDamageFightAlterationResult(affected, getStatsInfo(affected, opponent), getAttackInfo());
	if (burn.damages) {
		burn.damages *= opponent.getAlterationMultiplier(FightAlterations.BURNED); // Apply alteration multiplier
	}

	return burn;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 50,
		maxDamage: 65
	};
}

function getStatsInfo(affected: Fighter, opponent: Fighter): statsInfo {
	return {
		attackerStats: [opponent.getAttack()],
		defenderStats: [affected.getDefense() / 4],
		statsEffect: [1]
	};
}
