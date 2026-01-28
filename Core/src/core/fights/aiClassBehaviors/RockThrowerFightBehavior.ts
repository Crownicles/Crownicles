import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { Fighter } from "../fighter/Fighter";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { PlayerFighter } from "../fighter/PlayerFighter";

/**
 * Determines whether the AI should use a boomerang attack
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @param isGoingForChainedCanonAttack - Whether the AI is currently executing a chained canon attack strategy
 * @returns True if boomerang attack should be used, false otherwise
 */
export function shouldUseBoomerang(
	opponent: Fighter,
	me: AiPlayerFighter,
	isGoingForChainedCanonAttack: boolean
): boolean {
	return !opponent.hasFightAlteration()
		&& (opponent.getSpeed() > me.getSpeed() * 0.6
			|| RandomUtils.crowniclesRandom.bool(0.22))
		&& !isGoingForChainedCanonAttack
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.BOOMERANG_ATTACK);
}

/**
 * Determines whether the AI should start a canon attack sequence
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @param canonAttackUsed - Number of canon attacks already used
 * @param isGoingForChainedCanonAttack - Whether the AI is currently executing a chained canon attack strategy
 * @returns True if fighter should start a canon attack sequence, false otherwise
 */
export function shouldStartCanonSequence(
	opponent: PlayerFighter,
	me: AiPlayerFighter,
	canonAttackUsed: number,
	isGoingForChainedCanonAttack: boolean
): boolean {
	return !isGoingForChainedCanonAttack
		&& canonAttackUsed === 0
		&& opponent.getEnergy() > 400
		&& (me.getSpeed() * 0.75 > opponent.getSpeed()
			|| (me.getBreath() >= 10 // If ai is not able to use boomerang, be more lenient on speed requirement
				&& opponent.hasFightAlteration()
				&& opponent.alteration?.id !== FightConstants.FIGHT_ACTIONS.ALTERATION.TARGETED))
		&& (opponent.player.class !== ClassConstants.CLASSES_ID.MYSTIC_MAGE
			|| (opponent.player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE
				&& me.hasFightAlteration()))

		// Need enough breath for at least three consecutive canon attacks
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK) + 4;
}

/**
 * Determines if the AI should continue a chained canon attack sequence
 * @param me - The AI fighter making the action decision
 * @param isGoingForChainedCanonAttack - Whether the AI is currently executing a chained canon attack strategy
 * @param canonAttackUsed - Number of canon attacks already used
 * @param turn - Current turn number in the fight
 * @returns True if fighter should continue a canon attack sequence, false otherwise
 */
export function shouldContinueCanonSequence(
	me: AiPlayerFighter,
	isGoingForChainedCanonAttack: boolean,
	canonAttackUsed: number,
	turn: number
): boolean {
	return turn > 2
		&& isGoingForChainedCanonAttack
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)
		&& canonAttackUsed <= 2;
}

class RockThrowerFightBehavior implements ClassBehavior {
	private isGoingForChainedCanonAttack = false;

	private canonAttackUsed = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as PlayerFighter;
		const turn = fightView.fightController.turn;

		// Continue a canon attack sequence if appropriate
		if (shouldContinueCanonSequence(me, this.isGoingForChainedCanonAttack, this.canonAttackUsed, turn)) {
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
		}

		// Clear the chained canon attack flag if 3 canon attacks have been used or not enough breath for the third
		if (
			this.isGoingForChainedCanonAttack
			&& (this.canonAttackUsed >= 3
				|| me.getBreath() < FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)
				&& this.canonAttackUsed === 2)
		) {
			this.isGoingForChainedCanonAttack = false;
		}

		// If opponent is very low health, finish them
		if (opponent.getEnergy() <= opponent.getMaxEnergy() * 0.06) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)!;
		}

		// Play boomerang when possible if the opponent has no alteration
		if (shouldUseBoomerang(opponent, me, this.isGoingForChainedCanonAttack)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.BOOMERANG_ATTACK)!;
		}

		// Start a canon attack sequence if appropriate
		if (shouldStartCanonSequence(opponent, me, this.canonAttackUsed, this.isGoingForChainedCanonAttack)) {
			this.isGoingForChainedCanonAttack = true;
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
		}

		// Quick attack when we have enough breath
		if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)!;
		}

		// Canon attack as fallback
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
	}
}

export default RockThrowerFightBehavior;
