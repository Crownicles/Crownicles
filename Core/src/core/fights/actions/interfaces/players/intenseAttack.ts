import { Fighter } from "../../../fighter/Fighter";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	attackInfo, statsInfo
} from "../../FightActionController";

const use: FightActionFunc = (sender, receiver) => {
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

	// This attack cannot kill the receiver
	if (result.damages! >= receiver.getEnergy()) {
		result.damages = receiver.getEnergy() - 1;
	}

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
