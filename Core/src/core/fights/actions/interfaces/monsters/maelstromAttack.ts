import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 110,
		averageDamage: 320,
		maxDamage: 500
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense() * 0.4],
		statsEffect: [1]
	};
}

const use: FightActionFunc = (sender, receiver, _fightAction) => {
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

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.SUBMERGED
	}, receiver);

	return {
		...result,
		customMessage: true
	};
};

export default use;
