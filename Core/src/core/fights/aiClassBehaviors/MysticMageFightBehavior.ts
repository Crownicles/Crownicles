import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
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

// The opening poison lands as a critical hit during the first turns of the fight
const POISON_OPENING_LAST_TURN = 2;

function getAction(id: string): FightAction {
	return FightActionDataController.instance.getById(id)!;
}

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Sets up one of its ailments, cashes it in with the dark attack while the attack is fresh,
 * then finishes with its other attacks while the dark attack recovers
 */
class MysticMageFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();

		// Early return if no opponent (should not happen in normal gameplay)
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		if (opponent.hasFightAlteration()) {
			if (getDarkAttackPowerMultiplier(me) >= MIN_WORTHWHILE_DARK_ATTACK_MULTIPLIER) {
				// Save the breath for the dark attack rather than spending it on a weaker hit
				return getAction(canAfford(me, ACTIONS.DARK_ATTACK) ? ACTIONS.DARK_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
			}
		}
		else {
			if (fightView.fightController.turn <= POISON_OPENING_LAST_TURN && canAfford(me, ACTIONS.POISONOUS_ATTACK)) {
				return getAction(ACTIONS.POISONOUS_ATTACK);
			}
			if (opponent.getEnergy() > opponent.getMaxEnergy() * CURSE_HEAL_ENERGY_RATIO && canAfford(me, ACTIONS.CURSED_ATTACK)) {
				return getAction(ACTIONS.CURSED_ATTACK);
			}
		}

		for (const actionId of [ACTIONS.FIRE_ATTACK, ACTIONS.POISONOUS_ATTACK]) {
			if (canAfford(me, actionId)) {
				return getAction(actionId);
			}
		}
		return getAction(ACTIONS.BREATH_TAKING_ATTACK);
	}
}

export default MysticMageFightBehavior;
