import { Fighter } from "../../../fighter/Fighter";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	attackInfo, statsInfo
} from "../../FightActionController";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 5,
			failure: sender.getSpeed() < receiver.getSpeed() ? 0 : 10
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	fightAction.capOpponentDamage(result, receiver);

	// The sender has to rest for 1 turn
	sender.nextFightAction = FightActionDataController.instance.getById("resting") ?? null;

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 25,
		averageDamage: 175,
		maxDamage: 275
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			receiver.getSpeed()
		],
		defenderStats: [
			receiver.getDefense() * 2,
			sender.getSpeed() * 0.70
		],
		statsEffect: [
			0.6,
			0.4
		]
	};
}
