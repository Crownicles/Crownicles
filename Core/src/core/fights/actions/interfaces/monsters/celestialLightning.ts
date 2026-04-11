import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 0,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 35% chance to paralyze the defender
	if (RandomUtils.crowniclesRandom.bool(0.35)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.PARALYZED
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
		minDamage: 30,
		averageDamage: 45,
		maxDamage: 100
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense() * 0.5,
			receiver.getSpeed()
		],
		statsEffect: [
			0.3,
			0.7
		]
	};
}
