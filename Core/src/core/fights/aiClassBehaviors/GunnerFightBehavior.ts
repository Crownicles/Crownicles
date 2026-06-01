import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	shouldContinueCanonSequence, shouldStartCanonSequence, shouldUseBoomerang
} from "./RockThrowerFightBehavior";
import { shouldUseSabotage } from "./SlingerFightBehavior";
import { Fighter } from "../fighter/Fighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";

/**
 * Determines if the AI should use intense attack based on speed comparison and remaining health
 * @param opponent - The opponent fighter in the current battle
 * @param me - The AI fighter making the action decision
 * @param isGoingForChainedCanonAttack - Whether currently using the chained canon attack strategy
 * @returns True if intense attack should be used, false otherwise
 */
function shouldUseIntenseAttack(
	opponent: Fighter,
	me: AiPlayerFighter,
	isGoingForChainedCanonAttack: boolean
): boolean {
	return !isGoingForChainedCanonAttack
		&& opponent.getSpeed() > me.getSpeed() * 0.8
		&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.2
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.INTENSE_ATTACK);
}

/**
 * Selects the appropriate finishing move when opponent is low on health
 * @param me - The AI fighter making the action decision
 * @param opponent - The opponent fighter in the current battle
 * @returns The selected finishing attack
 */
function chooseFinishingMove(me: AiPlayerFighter, opponent: RealPlayerFighter): FightAction {
	if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)
		&& me.getSpeed() > opponent.getSpeed()) {
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)!;
	}
	return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK)!;
}

class GunnerFightBehavior implements ClassBehavior {
	private isGoingForChainedCanonAttack = false;

	private canonAttackUsed = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter;
		const turn = fightView.fightController.turn;

		// Use canon attack again if used last turn to get 1.5x damage
		if (shouldContinueCanonSequence(me, this.isGoingForChainedCanonAttack, this.canonAttackUsed, turn)) {
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
		}

		// Clear the chained canon attack flag if not enough breath to continue
		if (
			this.isGoingForChainedCanonAttack
			&& me.getBreath() < FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)
		) {
			this.isGoingForChainedCanonAttack = false;
		}

		// If opponent is very low health, finish them with any attack
		if (opponent.getEnergy() <= opponent.getMaxEnergy() * 0.06) {
			return chooseFinishingMove(me, opponent);
		}

		// Play boomerang when possible if the opponent has no alteration
		if (shouldUseBoomerang(opponent, me, this.isGoingForChainedCanonAttack)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.BOOMERANG_ATTACK)!;
		}

		// After a boomerang, decide to focus on canon attack strategy
		if (shouldStartCanonSequence(opponent, me, this.canonAttackUsed, this.isGoingForChainedCanonAttack)) {
			this.isGoingForChainedCanonAttack = true;
			this.canonAttackUsed++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
		}

		// If the opponent has higher speed or close to it, and we have enough breath, use intense attack
		if (shouldUseIntenseAttack(opponent, me, this.isGoingForChainedCanonAttack)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.INTENSE_ATTACK)!;
		}

		// If the opponent has higher speed or close to it, use sabotage attack
		if (shouldUseSabotage(opponent, me)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK)!;
		}

		// Quick attack in other scenarios
		if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK)!;
		}

		// Fallback to canon attack if we don't have enough breath for a quick attack
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK)!;
	}
}

export default GunnerFightBehavior;
