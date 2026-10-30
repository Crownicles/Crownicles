import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { getUsedGodMoves } from "../FightController";

// A fight allows this many god moves (benediction, divine attack), both fighters included
export const MAX_GOD_MOVES_PER_FIGHT = 2;

function getBreathCost(actionId: string): number {
	return FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Breath the paladin keeps for its big moves still possible: the ultimate if not used yet, and one divine attack per
 * god move left in the fight (the opponent's god moves, such as a knight's benediction, use them up too)
 * @param me
 * @param opponent
 * @param usedUltimateAttacks
 */
function getBreathReserve(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, usedUltimateAttacks: number): number {
	const ultimateReserve = usedUltimateAttacks === 0 ? getBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK) : 0;
	const divineAttacksLeft = Math.max(0, MAX_GOD_MOVES_PER_FIGHT - getUsedGodMoves(me, opponent));
	return ultimateReserve + divineAttacksLeft * getBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK);
}

/**
 * Check if the paladin can spend the breath of an action without touching its reserve, or if it would otherwise lose
 * breath at its maximum on its next regeneration
 * @param me
 * @param opponent
 * @param usedUltimateAttacks
 * @param actionId
 */
export function hasBreathToSpare(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, usedUltimateAttacks: number, actionId: string): boolean {
	const breathLeft = me.getBreath() - getBreathCost(actionId);
	return breathLeft >= 0
		&& (breathLeft >= getBreathReserve(me, opponent, usedUltimateAttacks) || me.getBreath() + me.getRegenBreath() > me.getMaxBreath());
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
 * Check if the paladin should ram: to break the opponent's rest or ultimate charge, or to spend spare breath on an
 * opponent without alteration (never on a stunned one, which would chain the stuns). Its recoil makes it a poor default attack
 * @param me
 * @param opponent
 * @param usedUltimateAttacks
 */
export function shouldUseRamAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, usedUltimateAttacks: number): boolean {
	const ramAttack = FightConstants.FIGHT_ACTIONS.PLAYER.RAM_ATTACK;
	if (me.getBreath() < getBreathCost(ramAttack) || me.getEnergy() < me.getMaxEnergy() * 0.15) {
		return false;
	}
	if (isOpponentPreparing(opponent)) {
		return !opponent.hasFightAlteration() || opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.STUNNED;
	}
	return !opponent.hasFightAlteration() && hasBreathToSpare(me, opponent, usedUltimateAttacks, ramAttack);
}
