import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver, _fightAction) => {
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

	// 30% chance to stun the defender
	if (RandomUtils.crowniclesRandom.bool(0.3)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.STUNNED
		}, receiver);
	}

	return {
		...result,
		customMessage: true
	};
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
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.75,
			0.25
		]
	};
}
