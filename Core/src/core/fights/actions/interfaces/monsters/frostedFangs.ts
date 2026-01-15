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
			critical: 20,
			failure: 10
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 10% chance to freeze the defender
	if (RandomUtils.crowniclesRandom.bool(0.1)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.FROZEN
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
		minDamage: 35,
		averageDamage: 70,
		maxDamage: 110
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
			0.9,
			0.1
		]
	};
}
