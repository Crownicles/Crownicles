import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

/**
 * Each regrowth gives the hydra new heads: every head adds this share of the base damage
 */
const DAMAGE_BONUS_PER_REGROWTH = 0.35;

const MAX_DAMAGE_MULTIPLIER = 2.4;

/**
 * Damage multiplier of the bite depending on how many times the hydra has already regrown its heads
 * @param sender
 */
export function getMultiHeadBiteMultiplier(sender: Fighter): number {
	const regrowthCount = sender.fightActionsHistory
		.filter(action => action.id === FightConstants.FIGHT_ACTIONS.MONSTER.REGROWTH).length;
	return Math.min(1 + regrowthCount * DAMAGE_BONUS_PER_REGROWTH, MAX_DAMAGE_MULTIPLIER);
}

const use: FightActionFunc = (sender, receiver) => {
	const multiplier = getMultiHeadBiteMultiplier(sender);
	return simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 12,
			failure: 8
		},
		{
			attackInfo: getAttackInfo(multiplier),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
};

export default use;

function getAttackInfo(multiplier: number): attackInfo {
	return {
		minDamage: Math.round(20 * multiplier),
		averageDamage: Math.round(55 * multiplier),
		maxDamage: Math.round(95 * multiplier)
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}
