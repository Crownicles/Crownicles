import { Fighter } from "../../../fighter/Fighter";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultDamageFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	// 35 % chance to be healed from the poison (except for the first three turns)
	if (Math.random() < 0.35 && affected.alterationTurn > 3) {
		return defaultHealFightAlterationResult(affected);
	}

	const poison = defaultDamageFightAlterationResult(affected, getStatsInfo(affected, opponent), getAttackInfo());
	if (poison.damages) {
		poison.damages *= opponent.getAlterationMultiplier(FightAlterations.POISONED); // Apply alteration multiplier
	}

	return poison;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10, averageDamage: 25, maxDamage: 40
	};
}

function getStatsInfo(_victim: Fighter, sender: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()], defenderStats: [0], statsEffect: [1]
	};
}
