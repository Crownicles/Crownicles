import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import {
	customMessageActionResult, FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: FightActionFunc = (sender, _receiver, fightAction) => {
	const recoveredEnergy = Math.round(FightActionController.getAttackDamage(getStatsInfo(sender), sender, getAttackInfo(), true));

	const result = customMessageActionResult();
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: recoveredEnergy
	}, sender, fightAction);
	return {
		...result,
		customMessage: true
	};
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 30,
		maxDamage: 50
	};
}

function getStatsInfo(sender: Fighter): statsInfo {
	return {
		// We are comparing the max energy to the current energy to get the amount of recovered energy
		attackerStats: [sender.getMaxEnergy()],
		defenderStats: [sender.getEnergy()],
		statsEffect: [1]
	};
}
