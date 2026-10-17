import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const BLEEDING_PROBABILITY = 0.4;

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 30,
			failure: 10
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
	if (RandomUtils.crowniclesRandom.bool(BLEEDING_PROBABILITY)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.BLEEDING
		}, receiver);
	}
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 70,
		maxDamage: 120
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
			0.5,
			0.5
		]
	};
}
