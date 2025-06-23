import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { defaultMaxUsesFightActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { getUsedGodMoves } from "../../../FightController";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 85,
		averageDamage: 260,
		maxDamage: 380
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}

const use: FightActionFunc = (sender, receiver, _fightAction, turn) => {
	const usedGodMoves = getUsedGodMoves(sender, receiver);

	// Only works if less than 2 god moves have been used
	if (usedGodMoves >= 2) {
		return defaultMaxUsesFightActionResult();
	}

	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 0,
			failure: 97 - turn * 7 < 5 ? 5 : 97 - turn * 7
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	if (Math.random() < 0.2) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.PARALYZED
		}, receiver);
	}
	return result;
};

export default use;
