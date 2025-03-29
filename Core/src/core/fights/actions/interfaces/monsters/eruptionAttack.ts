import {FightActionFunc} from "../../../../../data/FightAction";
import {simpleDamageFightAction} from "../../templates/SimpleDamageFightActionTemplate";
import {attackInfo, statsInfo} from "../../FightActionController";
import {Fighter} from "../../../fighter/Fighter";

const use: FightActionFunc = (sender, receiver, _fightAction) => {
	const speedRatio = receiver.getSpeed() / sender.getSpeed();
	const failureProbability = speedRatio < 2 ? 0 : 5 + Math.min(70, Math.pow(speedRatio - 3, 2) * 3);
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 25,
			failure: failureProbability
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
	result.customMessage = true;
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 50,
		averageDamage: 90,
		maxDamage: 170
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack()
		],
		defenderStats: [
			receiver.getSpeed()
		],
		statsEffect: [
			1
		]
	};
}
