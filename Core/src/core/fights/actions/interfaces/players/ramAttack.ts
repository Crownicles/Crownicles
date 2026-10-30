import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

// Share of the computed recoil the sender actually takes when it is not stunned by its own attack
const RECOIL_DAMAGE_MULTIPLIER = 0.5;

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 5,
			failure: 6
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 70% chance to stun the defender
	if (Math.random() < 0.70) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.STUNNED
		}, receiver);
	}

	// Sender has a 25% chance to be stunned and 75% chance to be hurt by his own attack
	if (Math.random() < 0.25) {
		FightActionController.applyAlteration(result, {
			selfTarget: true,
			alteration: FightAlterations.STUNNED
		}, sender);
	}
	else {
		const damageFactor = 0.55;
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DAMAGE,
			operator: FightStatModifierOperation.ADDITION,
			value: Math.round(RECOIL_DAMAGE_MULTIPLIER * FightActionController.getAttackDamage({
				attackerStats: [
					sender.getDefense() * damageFactor,
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
				minDamage: 60 * damageFactor,
				averageDamage: 110 * damageFactor,
				maxDamage: 210 * damageFactor
			}))
		}, sender, fightAction);
	}

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 60,
		averageDamage: 110,
		maxDamage: 210
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getDefense(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.85,
			0.15
		]
	};
}
