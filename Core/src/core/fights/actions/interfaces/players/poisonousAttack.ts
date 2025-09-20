import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

const use: FightActionFunc = (sender, receiver, _fightAction, turn) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: turn < 3 ? 90 : 5, // 90% chance of critical hit for the first 2 turns, then 5%
			failure: turn < 7 ? 0 : 20 // 0% chance of failure for the first 6 turns, then 20%
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.POISONED
	}, receiver);
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 50,
		maxDamage: 90
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats:
			[sender.getAttack()],
		defenderStats:
			[receiver.getDefense() * 0.5],
		statsEffect: [1]
	};
}
