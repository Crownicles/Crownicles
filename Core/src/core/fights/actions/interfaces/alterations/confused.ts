import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { FightActionDataController } from "../../../../../data/FightAction";
import {
	defaultDamageFightAlterationResult, defaultFightAlterationResult, defaultHealFightAlterationResult, defaultRandomActionFightAlterationResult
} from "../../../FightController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	// Heal the confusion after 3 turns
	if (affected.alterationTurn > 3 || RandomUtils.crowniclesRandom.bool() && affected.alterationTurn === 3) {
		return defaultHealFightAlterationResult(affected);
	}

	if (RandomUtils.crowniclesRandom.bool(0.6)) {
		return defaultRandomActionFightAlterationResult(affected);
	}

	if (RandomUtils.crowniclesRandom.bool(0.5)) {
		affected.nextFightAction = FightActionDataController.instance.getNone();
		return defaultDamageFightAlterationResult(affected, getStatsInfo(affected, opponent), getAttackInfo());
	}

	return defaultFightAlterationResult();
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 15,
		maxDamage: 35
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			receiver.getAttack(),
			sender.getAttack()
		],
		defenderStats: [
			100,
			100
		],
		statsEffect: [
			0.8,
			0.2
		]
	};
}
