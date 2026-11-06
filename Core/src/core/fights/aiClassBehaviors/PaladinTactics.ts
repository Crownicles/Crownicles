import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

// A fight allows this many god moves (benediction, divine attack), both fighters included
export const MAX_GOD_MOVES_PER_FIGHT = 2;

function getBreathCost(actionId: string): number {
	return FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Check if the paladin can spend the breath of an action and still charge its ultimate if not used yet, or if it would
 * otherwise lose breath at its maximum on its next regeneration. Keeping the breath of the divine attacks too left it
 * nothing to spend, and it played its simple attack more than half of the time
 * @param me
 * @param usedUltimateAttacks
 * @param actionId
 */
export function hasBreathToSpare(me: AiPlayerFighter, usedUltimateAttacks: number, actionId: string): boolean {
	const breathLeft = me.getBreath() - getBreathCost(actionId);
	const reserve = usedUltimateAttacks === 0 ? getBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK) : 0;
	return breathLeft >= 0
		&& (breathLeft >= reserve || me.getBreath() + me.getRegenBreath() > me.getMaxBreath());
}

/**
 * Check if the opponent has just started resting or charging its ultimate, which a ram can break
 * @param opponent
 */
function isOpponentPreparing(opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	const opponentLastActionId = opponent.getLastFightActionUsed()?.id;
	return opponentLastActionId === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
		|| opponentLastActionId === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK;
}

/**
 * Check if the paladin should ram: to break the opponent's rest or ultimate charge, or to strike an opponent that
 * already suffers another alteration than a stun, which the ram cannot stun. Rams that would stun a clean opponent, or
 * stun a stunned one again, are left out: chained, they keep it stunned, which is no fun to fight against
 * @param me
 * @param opponent
 */
export function shouldUseRamAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	const ramAttack = FightConstants.FIGHT_ACTIONS.PLAYER.RAM_ATTACK;
	if (me.getBreath() < getBreathCost(ramAttack) || me.getEnergy() < me.getMaxEnergy() * 0.15) {
		return false;
	}
	if (isOpponentPreparing(opponent)) {
		return !opponent.hasFightAlteration() || opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.STUNNED;
	}
	return opponent.hasFightAlteration() && opponent.alteration?.id !== FightConstants.FIGHT_ACTIONS.ALTERATION.STUNNED;
}
