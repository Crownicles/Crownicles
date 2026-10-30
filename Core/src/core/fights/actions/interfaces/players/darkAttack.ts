import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightActionStatus } from "../../../../../../../Lib/src/types/FightActionStatus";
import {
	getDarkAttackPowerMultiplier, recordMissedDarkAttack
} from "../../DarkAttackWear";

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 20,
			failure: 9
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	if (result.attackStatus === FightActionStatus.MISSED) {
		recordMissedDarkAttack(sender);
	}

	// The current use is pushed to the history after the action: the multiplier only counts the previous ones
	if (result.damages) {
		result.damages = Math.round(result.damages * getDarkAttackPowerMultiplier(sender));
	}

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 40,
		averageDamage: 68,
		maxDamage: 137
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			receiver.getAttack()
		],
		defenderStats: [
			receiver.getDefense() * 0.15,
			receiver.getDefense() * 0.05
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}
