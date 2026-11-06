import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

// Classes that can weaken (shield attack) or stun (ram attack) the infantryman for several turns
const CONTROLLING_CLASSES: number[] = [ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, ClassConstants.CLASSES_ID.LUMINOUS_PALADIN];

const KNIGHT_LIKE_CLASSES: number[] = [
	ClassConstants.CLASSES_ID.KNIGHT,
	ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
	ClassConstants.CLASSES_ID.HORSE_RIDER,
	ClassConstants.CLASSES_ID.PIKEMAN,
	ClassConstants.CLASSES_ID.ESQUIRE
];

// Actions announcing a big hit on the opponent's next turn, which the charged attack answers
const CHARGING_ACTIONS: string[] = [ACTIONS.CHARGE_ULTIMATE_ATTACK, ACTIONS.CHARGE_CHARGING_ATTACK];

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Check if the infantryman should protect itself from a class able to weaken or stun it: the protection
 * blocks these alterations, which keeps a human from chaining them against the AI
 * @param me
 * @param opponent
 */
export function shouldProtectAgainstControl(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	return CONTROLLING_CLASSES.includes(opponent.player.class)
		&& !me.hasFightAlteration()
		&& opponent.getBreath() >= FightActionDataController.getFightActionBreathCost(ACTIONS.RAM_ATTACK)
		&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.14
		&& canAfford(me, ACTIONS.PROTECTION);
}

/**
 * Check if the infantryman opens with its charged attack, which also raises its defense while it charges
 * @param me
 * @param turn
 */
export function shouldOpenWithChargedAttack(me: AiPlayerFighter, turn: number): boolean {
	return turn <= 2 && canAfford(me, ACTIONS.CHARGE_CHARGING_ATTACK);
}

export function isOpponentKnightLike(opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	return KNIGHT_LIKE_CLASSES.includes(opponent.player.class);
}

/**
 * Check if the opponent prepares a big hit for its next turn: a charged attack, an ultimate, a canon chain, or a
 * knight's rest (60% of the time, to stay unpredictable)
 * @param opponent
 */
export function isOpponentCharging(opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	const lastActionId = opponent.getLastFightActionUsed()?.id;
	if (lastActionId === ACTIONS.RESTING) {
		return isOpponentKnightLike(opponent) && RandomUtils.crowniclesRandom.bool(0.6);
	}
	if (lastActionId === ACTIONS.CANON_ATTACK) {
		return opponent.getBreath() >= 2;
	}
	return lastActionId !== undefined && CHARGING_ACTIONS.includes(lastActionId);
}
