import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	customMessageActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";


const use: FightActionFunc = (sender, receiver) => {
	// If the receiver just used a distance attack, the spirit glides out of reach and slows them
	if (receiver.getLastFightActionUsed()?.type === FightActionType.DISTANCE) {
		const result = customMessageActionResult();
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.SLOWED
		}, receiver);
		return {
			...result,
			damages: 0
		};
	}

	// Otherwise, a small retaliatory water strike
	return simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 10,
			failure: 20
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 15,
		averageDamage: 35,
		maxDamage: 55
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
			0.6,
			0.4
		]
	};
}
