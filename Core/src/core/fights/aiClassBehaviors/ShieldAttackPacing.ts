import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

/*
 * The shield attack weakens its target (-70% attack for two turns). Cast again as soon as the weakness wears off, it keeps
 * the opponent weakened for most of the fight, which is no fun to fight against: the AI casts it once per fight
 */
const MAX_SHIELD_ATTACKS_PER_FIGHT = 1;

/**
 * Check if the AI may weaken its opponent with the shield attack: affordable, the opponent has no alteration,
 * and the AI has not used up its shield attacks for this fight
 * @param me
 * @param opponent
 * @param breathToKeep Breath the AI wants to keep after the shield attack
 */
export function canPlayShieldAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, breathToKeep = 0): boolean {
	const shieldAttack = FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK;
	const shieldAttacksUsed = me.fightActionsHistory.filter(action => action.id === shieldAttack).length;
	return !opponent.hasFightAlteration()
		&& shieldAttacksUsed < MAX_SHIELD_ATTACKS_PER_FIGHT
		&& me.getBreath() - FightActionDataController.getFightActionBreathCost(shieldAttack) >= breathToKeep;
}
