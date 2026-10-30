import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const SLOWED_PROBABILITY = 0.5;

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 10,
			failure: 10
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
	if (RandomUtils.crowniclesRandom.bool(SLOWED_PROBABILITY)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.SLOWED
		}, receiver);
	}
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 60,
		maxDamage: 100
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getSpeed(),
			sender.getAttack()
		],
		defenderStats: [
			receiver.getSpeed(),
			receiver.getDefense()
		],
		statsEffect: [
			0.6,
			0.4
		]
	};
}
