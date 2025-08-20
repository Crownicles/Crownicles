import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver) => {
	const initialDamage = FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo());
	const damageDealt = FightActionController.applySecondaryEffects(initialDamage, 3, 8);

	const result: FightActionResult = {
		attackStatus: damageDealt.status,
		damages: damageDealt.damages
	};

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: RandomUtils.crowniclesRandom.bool(0.1) ? FightAlterations.BURNED : FightAlterations.BLIND
	}, receiver);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 40,
		averageDamage: 135,
		maxDamage: 170
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense() / 5],
		statsEffect: [1]
	};
}
