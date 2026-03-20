import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import {
	FightActionFunc
} from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	customMessageActionResult,
	defaultFightActionResult, FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const BREATH_RATIO = 0.7;

const use: FightActionFunc = (sender, receiver, fightAction) => {
	if (receiver.getBreath() >= BREATH_RATIO * receiver.getMaxBreath()) {
		const result = defaultFightActionResult();
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.BREATH,
			operator: FightStatModifierOperation.ADDITION,
			value: receiver.getBreath() > 1 ? -2 : -1
		}, receiver, fightAction);

		return {
			...customMessageActionResult(),
			damages: 0
		};
	}

	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 0,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	return {
		...result,
		customMessage: true
	};
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 50,
		averageDamage: 100,
		maxDamage: 150
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getSpeed(),
			sender.getAttack()
		],
		defenderStats: [
			receiver.getSpeed(),
			receiver.getDefense()
		],
		statsEffect: [
			0.1,
			0.9
		]
	};
}
