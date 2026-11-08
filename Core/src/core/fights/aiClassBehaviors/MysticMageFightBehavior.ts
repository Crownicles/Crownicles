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

// Below this multiplier, the dark attack is too worn: the mage turns to its other attacks until it recovers
const WORN_OUT_DARK_ATTACK_MULTIPLIER = 0.8;

// The dark attack is cast from this multiplier only: fresh, at most once more, then it rests
const MIN_DARK_ATTACK_MULTIPLIER = 1.3;

// The curse heals the mage only while the opponent has more than this share of its energy
const CURSE_HEAL_ENERGY_RATIO = 0.4;

// Actions an opponent heals itself with, which the curse reduces
const HEALING_ACTIONS = [ACTIONS.RESTING, ACTIONS.ENERGETIC_ATTACK];

export function getAction(id: string): FightAction {
	return FightActionDataController.instance.getById(id)!;
}

export function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Move against an opponent that already suffers an alteration: the fresh dark attack cashes it in, the mage saving
 * its breath with its cheap attack until it can afford it. Null once the dark attack is worn out, or too worn to be
 * worth its breath. A cursed opponent always takes the dark attack at full power
 * @param me
 * @param opponent
 */
export function chooseAgainstAilingOpponent(me: AiPlayerFighter, opponent: Fighter): FightAction | null {
	const darkAttackMultiplier = getDarkAttackPowerMultiplier(me, opponent);
	if (darkAttackMultiplier < WORN_OUT_DARK_ATTACK_MULTIPLIER) {
		return null;
	}
	if (!canAfford(me, ACTIONS.DARK_ATTACK)) {
		return getAction(ACTIONS.BREATH_TAKING_ATTACK);
	}
	return darkAttackMultiplier >= MIN_DARK_ATTACK_MULTIPLIER ? getAction(ACTIONS.DARK_ATTACK) : null;
}

/**
 * Ailment to set up on a clean opponent: the curse against the classes that heal or while it still heals the mage,
 * the poison otherwise. Null when none is affordable
 * @param me
 * @param opponent
 */
function chooseSetup(me: AiPlayerFighter, opponent: Fighter): FightAction | null {
	// The curse cuts the healing of the classes that rely on it
	const opponentHeals = HEALING_ACTIONS.some(actionId => opponent.availableFightActions.has(actionId));
	if ((opponentHeals || opponent.getEnergy() > opponent.getMaxEnergy() * CURSE_HEAL_ENERGY_RATIO) && canAfford(me, ACTIONS.CURSED_ATTACK)) {
		return getAction(ACTIONS.CURSED_ATTACK);
	}
	return canAfford(me, ACTIONS.POISONOUS_ATTACK) ? getAction(ACTIONS.POISONOUS_ATTACK) : null;
}

/**
 * Attack while the dark attack recovers: the fire attack with enough breath, else the breath-taking attack, whose
 * stolen breath pays for the next dark attack (it wins more fights than the poison as a filler)
 * @param me
 * @param minFireBreath Breath from which the mage spends it on the fire attack
 */
export function chooseDamagingAttack(me: AiPlayerFighter, minFireBreath = FightActionDataController.getFightActionBreathCost(ACTIONS.FIRE_ATTACK)): FightAction {
	return getAction(me.getBreath() >= minFireBreath && canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
}

class MysticMageFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();

		// Early return if no opponent (should not happen in normal gameplay)
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		const planned = opponent.hasFightAlteration()
			? chooseAgainstAilingOpponent(me, opponent)
			: chooseSetup(me, opponent);
		if (planned) {
			return planned;
		}

		return chooseDamagingAttack(me);
	}
}

export default MysticMageFightBehavior;
