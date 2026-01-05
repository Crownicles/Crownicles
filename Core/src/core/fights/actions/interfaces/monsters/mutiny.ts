import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 45,
			failure: 2
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	const damageFactor = 0.75;
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.DAMAGE,
		operator: FightStatModifierOperation.ADDITION,
		value: FightActionController.getAttackDamage({
			attackerStats: [
				sender.getAttack() * damageFactor,
				sender.getSpeed() * damageFactor,
				sender.getDefense()
			],
			defenderStats: [
				sender.getDefense(),
				sender.getSpeed(),
				receiver.getDefense()
			],
			statsEffect: [
				0.45,
				0.15,
				0.40
			]
		}, sender, {
			minDamage: 90 * damageFactor,
			averageDamage: 150 * damageFactor,
			maxDamage: 250 * damageFactor
		})
	}, sender, fightAction);

	return {
		...result,
		customMessage: true
	};
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 90,
		averageDamage: 150,
		maxDamage: 250
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
			0.95,
			0.05
		]
	};
}
