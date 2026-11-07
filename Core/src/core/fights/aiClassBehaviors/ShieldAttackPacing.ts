import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/*
 * The shield attack weakens its target (-70% attack for two turns). Cast again as soon as the weakness wears off, it keeps
 * the opponent weakened for most of the fight, which is no fun to fight against. Each AI gets a chance to cast it,
 * by number of shield attacks it already cast in the fight, and never casts more than the length of the list
 */
export const SHIELD_ATTACK_CHANCES = {
	// The tank leans on its shield: the chance drops with each use instead of a hard cap
	DECREASING: [
		0.9,
		0.5,
		0.2
	],

	/*
	 * The paladin weakens its opponent once, and sometimes a second time: with a single weakening, its AI won fewer than
	 * one defense in five against strong attackers, while two keep the attacker under control about a quarter of its turns
	 */
	SPARING: [
		1,
		0.5
	]
} as const;

export type ShieldAttackChances = typeof SHIELD_ATTACK_CHANCES[keyof typeof SHIELD_ATTACK_CHANCES];

/**
 * Check if the AI may weaken its opponent with the shield attack: affordable, the opponent has no alteration,
 * and the chance of its next use in the fight succeeds
 * @param me
 * @param opponent
 * @param chances Chance to cast it, by number of shield attacks already cast in the fight
 * @param pacing Breath the AI wants to keep after the shield attack, and number of weakening shield attacks it already
 * cast in the fight (all its shield attacks by default)
 */
export function canPlayShieldAttack(
	me: AiPlayerFighter,
	opponent: AiPlayerFighter | RealPlayerFighter,
	chances: ShieldAttackChances,
	pacing: {
		breathToKeep?: number;
		weakeningShieldAttacksCast?: number;
	} = {}
): boolean {
	const shieldAttack = FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK;
	const shieldAttacksUsed = pacing.weakeningShieldAttacksCast ?? me.fightActionsHistory.filter(action => action.id === shieldAttack).length;
	if (opponent.hasFightAlteration() || shieldAttacksUsed >= chances.length) {
		return false;
	}
	if (me.getBreath() - FightActionDataController.getFightActionBreathCost(shieldAttack) < (pacing.breathToKeep ?? 0)) {
		return false;
	}
	const chance = chances[shieldAttacksUsed];
	return chance >= 1 || RandomUtils.crowniclesRandom.bool(chance);
}

/**
 * Check if the AI can strike with the shield attack, which scales on its defense, without weakening its opponent: the
 * opponent already suffers another alteration, which a fighter keeps until it wears off. Against a weakened opponent, it
 * would weaken it again for two more turns
 * @param me
 * @param opponent
 * @param breathToKeep Breath the AI wants to keep after the shield attack
 */
export function canStrikeWithShieldAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, breathToKeep = 0): boolean {
	return opponent.hasFightAlteration()
		&& opponent.alteration?.id !== FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK
		&& me.getBreath() - FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK) >= breathToKeep;
}
