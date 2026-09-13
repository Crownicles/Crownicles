import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 5,
			failure: 15
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.WEAK
	}, receiver);
	return result;
};

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 80,
		maxDamage: 130
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getDefense(),
			sender.getAttack()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getDefense()
		],
		statsEffect: [
			0.8,
			0.2
		]
	};
}

export default use;
