import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Check if the opponent has just rested and the energetic attack is affordable: it deals more damage to a rested opponent
 * @param me
 * @param opponent
 */
export function shouldPunishRest(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
	return opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
		&& canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
}

/**
 * Check if the veteran is concentrated and can spend this boost on an energetic attack
 * @param me
 */
export function shouldUseConcentratedEnergeticAttack(me: AiPlayerFighter): boolean {
	return me.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.CONCENTRATED
		&& canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
}

/**
 * Check if concentrating now leaves enough breath, after the regeneration, for an energetic attack on the next turn,
 * and if the veteran cannot already afford both actions without waiting
 * @param me
 */
export function shouldConcentrateBeforeEnergeticAttack(me: AiPlayerFighter): boolean {
	const concentrationCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CONCENTRATION);
	const energeticAttackCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
	return canConcentrateForNextEnergeticAttack(me) && me.getBreath() < energeticAttackCost + concentrationCost;
}

/**
 * Check if the veteran can concentrate now and still afford an energetic attack on the next turn, after the regeneration
 * @param me
 */
export function canConcentrateForNextEnergeticAttack(me: AiPlayerFighter): boolean {
	const concentrationCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CONCENTRATION);
	const energeticAttackCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
	return !me.hasFightAlteration()
		&& me.getBreath() >= concentrationCost
		&& me.getBreath() - concentrationCost + me.getRegenBreath() >= energeticAttackCost;
}
