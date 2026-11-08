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
		result.damages = Math.round(result.damages * getDarkAttackPowerMultiplier(sender, receiver));
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

/*
 * The dark attack turns the target's own attack against it and only counts a small share of its defense. That share must
 * not be negligible: the defense brought by the target's gear would otherwise never protect it from the mage
 */
function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			receiver.getAttack()
		],
		defenderStats: [
			receiver.getDefense() * 0.3,
			receiver.getDefense() * 0.1
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}
