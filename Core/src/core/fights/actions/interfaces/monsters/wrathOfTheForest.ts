import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

/**
 * The wrath grows with the wounds of the forest: at zero energy, the damage would be multiplied by 1 + this factor
 */
const MISSING_ENERGY_DAMAGE_FACTOR = 2;

/**
 * Damage multiplier of the wrath depending on the missing energy of the sender
 * @param sender
 */
export function getWrathOfTheForestMultiplier(sender: Fighter): number {
	const missingEnergyRatio = 1 - sender.getEnergy() / sender.getMaxEnergy();
	return 1 + Math.max(0, missingEnergyRatio) * MISSING_ENERGY_DAMAGE_FACTOR;
}

const use: FightActionFunc = (sender, receiver) => {
	const multiplier = getWrathOfTheForestMultiplier(sender);
	return {
		...simpleDamageFightAction(
			{
				sender,
				receiver
			},
			{
				critical: 10,
				failure: 5
			},
			{
				attackInfo: getAttackInfo(multiplier),
				statsInfo: getStatsInfo(sender, receiver)
			}
		),
		customMessage: true
	};
};

export default use;

function getAttackInfo(multiplier: number): attackInfo {
	return {
		minDamage: Math.round(25 * multiplier),
		averageDamage: Math.round(60 * multiplier),
		maxDamage: Math.round(100 * multiplier)
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}
