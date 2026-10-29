import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { Fighter } from "../fighter/Fighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { getDarkAttackPowerMultiplier } from "../actions/DarkAttackWear";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

// Below this multiplier, the worn dark attack is left aside until it recovers
const MIN_WORTHWHILE_DARK_ATTACK_MULTIPLIER = 0.8;

// The curse heals the mage only while the opponent has more than this share of its energy
const CURSE_HEAL_ENERGY_RATIO = 0.4;

// Actions an opponent heals itself with, which the curse reduces
const HEALING_ACTIONS = [ACTIONS.RESTING, ACTIONS.ENERGETIC_ATTACK];

// The opening poison lands as a critical hit during the first turns of the fight
const POISON_OPENING_LAST_TURN = 2;

export function getAction(id: string): FightAction {
	return FightActionDataController.instance.getById(id)!;
}

export function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Move against an opponent that already suffers an alteration: the fresh dark attack cashes it in, saving the breath
 * for it if needed. Null once the dark attack is worn below the given multiplier
 * @param me
 * @param minDarkAttackMultiplier
 */
export function chooseAgainstAilingOpponent(me: AiPlayerFighter, minDarkAttackMultiplier = MIN_WORTHWHILE_DARK_ATTACK_MULTIPLIER): FightAction | null {
	if (getDarkAttackPowerMultiplier(me) < minDarkAttackMultiplier) {
		return null;
	}
	return getAction(canAfford(me, ACTIONS.DARK_ATTACK) ? ACTIONS.DARK_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
}

/**
 * Ailment to set up on a clean opponent: the curse first against the classes that heal, the poison at the opening,
 * the curse while it still heals the mage. Null when none applies
 */
function chooseSetup(me: AiPlayerFighter, opponent: Fighter, turn: number): FightAction | null {
	// The curse cuts the healing of the classes that rely on it
	if (HEALING_ACTIONS.some(actionId => opponent.availableFightActions.has(actionId)) && canAfford(me, ACTIONS.CURSED_ATTACK)) {
		return getAction(ACTIONS.CURSED_ATTACK);
	}
	if (turn <= POISON_OPENING_LAST_TURN && canAfford(me, ACTIONS.POISONOUS_ATTACK)) {
		return getAction(ACTIONS.POISONOUS_ATTACK);
	}
	if (opponent.getEnergy() > opponent.getMaxEnergy() * CURSE_HEAL_ENERGY_RATIO && canAfford(me, ACTIONS.CURSED_ATTACK)) {
		return getAction(ACTIONS.CURSED_ATTACK);
	}
	return null;
}

/**
 * Strongest affordable attack while the dark attack recovers: the fire attack, else the poison, else the cheap breath-taking attack
 * @param me
 */
export function chooseDamagingAttack(me: AiPlayerFighter): FightAction {
	for (const actionId of [ACTIONS.FIRE_ATTACK, ACTIONS.POISONOUS_ATTACK]) {
		if (canAfford(me, actionId)) {
			return getAction(actionId);
		}
	}
	return getAction(ACTIONS.BREATH_TAKING_ATTACK);
}

/**
 * Occultist mage: sets up one of its ailments (the curse first against an opponent that heals), cashes it in with
 * the dark attack while the attack is fresh, then finishes with its other attacks while the dark attack recovers
 */
class MysticMageFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();

		// Early return if no opponent (should not happen in normal gameplay)
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		const planned = opponent.hasFightAlteration()
			? chooseAgainstAilingOpponent(me)
			: chooseSetup(me, opponent, fightView.fightController.turn);
		if (planned) {
			return planned;
		}

		return chooseDamagingAttack(me);
	}
}

export default MysticMageFightBehavior;
