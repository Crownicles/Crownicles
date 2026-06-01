import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/**
 * Determines whether to use a piercing or simple attack based on fighter conditions
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @returns The selected FightAction (piercing attack, simple attack, or protection)
 */
export function piercingOrSimpleAttack(opponent: RealPlayerFighter | AiPlayerFighter, me: AiPlayerFighter): FightAction {
	// Use piercing attack if the opponent has high defense
	if (
		(opponent.getDefense() > me.getDefense()
			|| RandomUtils.crowniclesRandom.bool(0.2))
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.PIERCING_ATTACK)
	) {
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.PIERCING_ATTACK)!;
	}

	// Fallback to simple attack or protection if not enough breath
	if (
		me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK)
	) {
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK)!;
	}

	return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.PROTECTION)!;
}

/**
 * Determines if the AI should use a protection action based on opponent class and battle state
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @param turn - Current turn number in the fight
 * @returns True if protection should be used, false otherwise
 */
export function shouldProtect(opponent: RealPlayerFighter | AiPlayerFighter, me: AiPlayerFighter, turn: number): boolean {
	// If the opponent is a mage, or a gunner with a lot of breath, and we are not protected, use protection
	return (opponent.player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE
			|| (opponent.player.class === ClassConstants.CLASSES_ID.GUNNER
				|| opponent.player.class === ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER
				|| opponent.player.class === ClassConstants.CLASSES_ID.ARCHER
				|| opponent.player.class === ClassConstants.CLASSES_ID.SLINGER
				|| opponent.player.class === ClassConstants.CLASSES_ID.ROCK_THROWER)
			&& opponent.getBreath() > 4
			|| (turn <= 2 && RandomUtils.crowniclesRandom.bool(0.7)) // First turns, use protection to protect against pets with 70% chance
	)
		&& !me.hasFightAlteration()
		&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.14; // Don't use this if the opponent is about to die
}

class RecruitFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter; // AI will never fight monsters

		if (shouldProtect(opponent, me, fightView.fightController.turn)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.PROTECTION)!;
		}

		return piercingOrSimpleAttack(opponent, me);
	}
}

export default RecruitFightBehavior;
