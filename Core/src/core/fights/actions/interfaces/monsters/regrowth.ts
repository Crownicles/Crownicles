import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import {
	customMessageActionResult, FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

/**
 * Below this share of its maximum energy, the regrowth draws harder on the sap and heals more
 */
const WOUNDED_ENERGY_RATIO = 0.5;

const WOUNDED_HEAL_MULTIPLIER = 1.5;

/**
 * Heal multiplier of the regrowth depending on how wounded the sender is
 * @param sender
 */
export function getRegrowthMultiplier(sender: Fighter): number {
	return sender.getEnergy() < sender.getMaxEnergy() * WOUNDED_ENERGY_RATIO ? WOUNDED_HEAL_MULTIPLIER : 1;
}

const use: FightActionFunc = (sender, _receiver, fightAction) => {
	const recoveredEnergy = Math.round(FightActionController.getAttackDamage(getStatsInfo(sender), sender, getAttackInfo(), true) * getRegrowthMultiplier(sender));

	const result = customMessageActionResult();
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: recoveredEnergy
	}, sender, fightAction);
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 25,
		maxDamage: 45
	};
}

function getStatsInfo(sender: Fighter): statsInfo {
	return {
		// Compare the max energy to the current energy: the more wounded, the more energy is recovered
		attackerStats: [sender.getMaxEnergy()],
		defenderStats: [sender.getEnergy()],
		statsEffect: [1]
	};
}
