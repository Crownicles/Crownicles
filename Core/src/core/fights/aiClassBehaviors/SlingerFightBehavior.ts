import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	shouldUseBoomerang, shouldStartCanonSequence, shouldContinueCanonSequence
} from "./RockThrowerFightBehavior";
import { Fighter } from "../fighter/Fighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";

/**
 * Determines if the AI should use sabotage attack based on speed comparison
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @returns True if sabotage attack should be used, false otherwise
 */
export function shouldUseSabotage(opponent: Fighter, me: AiPlayerFighter): boolean {
	return opponent.getSpeed() > me.getSpeed() * 0.8
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK);
}

class SlingerFightBehavior implements ClassBehavior {
	private isGoingForChainedCanonAttack = false;

	private canonAttackUsed = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter;
		const turn = fightView.fightController.turn;

		// Continue a canon attack sequence if appropriate
		if (shouldContinueCanonSequence(me, this.isGoingForChainedCanonAttack, this.canonAttackUsed, turn)) {
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK);
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

		// If opponent is very low health, finish them with any attack
		if (opponent.getEnergy() <= opponent.getMaxEnergy() * 0.06) {
			// Quick Attack is good for finishing off enemies if we have enough breath
			if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)) {
				return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK);
			}

			// Slinger has sabotage attack as a fallback
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK);
		}

		// Play boomerang when possible if the opponent has no alteration
		if (shouldUseBoomerang(opponent, me, this.isGoingForChainedCanonAttack)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.BOOMERANG_ATTACK);
		}

		// Start a canon attack sequence if appropriate
		if (shouldStartCanonSequence(opponent, me, this.canonAttackUsed, this.isGoingForChainedCanonAttack)) {
			this.isGoingForChainedCanonAttack = true;
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK);
		}

		// If the opponent has higher speed or close to it, use sabotage attack
		if (shouldUseSabotage(opponent, me)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK);
		}

		// Quick attack when we have enough breath
		if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK);
		}

		// Canon attack as fallback
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK);
	}
}

export default SlingerFightBehavior;
