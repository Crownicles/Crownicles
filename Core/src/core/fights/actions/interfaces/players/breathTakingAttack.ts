import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

// Maximum amount of breath stolen from the opponent, starving them of the breath their strongest attacks need
const MAX_STOLEN_BREATH = 2;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 30,
		averageDamage: 60,
		maxDamage: 100
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.7,
			0.3
		]
	};
}

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 1,
			failure: 10
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 40% chance of reducing the opponent's speed by 15%. Otherwise, steal up to 2 points of breath from the opponent.
	if (RandomUtils.crowniclesRandom.bool(0.4) || receiver.getBreath() < 1) {
		// Reduce the target speed by 15%
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.85
		}, receiver, fightAction);
	}
	else {
		const stolenBreath = Math.min(MAX_STOLEN_BREATH, receiver.getBreath());
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.BREATH,
			operator: FightStatModifierOperation.ADDITION,
			value: -stolenBreath
		}, receiver, fightAction);
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.BREATH,
			operator: FightStatModifierOperation.ADDITION,
			value: stolenBreath
		}, sender, fightAction);
	}
	return result;
};

export default use;
