import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { Fighter } from "../../../fighter/Fighter";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	attackInfo, statsInfo
} from "../../FightActionController";

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender, receiver
		},
		{
			critical: 70, failure: 0
		},
		{
			attackInfo: getAttackInfo(), statsInfo: getStatsInfo(sender, receiver)
		}
	);
	result.customMessage = true;
	sender.nextFightAction = FightActionDataController.instance.getById("packAttack") ?? null;
	return result;
};

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 10,
		maxDamage: 25
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			120,
			sender.getAttack()
		],
		defenderStats: [
			receiver.getDefense() / 10,
			receiver.getDefense()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

export default use;
