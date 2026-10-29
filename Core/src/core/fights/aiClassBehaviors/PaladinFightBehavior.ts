import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { canPlayShieldAttack } from "./ShieldAttackPacing";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { getUsedGodMoves } from "../FightController";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";

// A fight allows this many god moves (benediction, divine attack), both fighters included
export const MAX_GOD_MOVES_PER_FIGHT = 2;

function getBreathCost(actionId: string): number {
	return FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Breath the paladin keeps for its big moves still possible: the ultimate if not used yet, and one divine attack per
 * god move left in the fight (the opponent's god moves, such as a knight's benediction, use them up too)
 * @param me
 * @param opponent
 * @param usedUltimateAttacks
 */
function getBreathReserve(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, usedUltimateAttacks: number): number {
	const ultimateReserve = usedUltimateAttacks === 0 ? getBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK) : 0;
	const divineAttacksLeft = Math.max(0, MAX_GOD_MOVES_PER_FIGHT - getUsedGodMoves(me, opponent));
	return ultimateReserve + divineAttacksLeft * getBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK);
}

/**
 * Check if the paladin can spend the breath of an action without touching its reserve, or if it would otherwise lose
 * breath at its maximum on its next regeneration
 * @param me
 * @param opponent
 * @param usedUltimateAttacks
 * @param actionId
 */
function hasBreathToSpare(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, usedUltimateAttacks: number, actionId: string): boolean {
	const breathLeft = me.getBreath() - getBreathCost(actionId);
	return breathLeft >= 0
		&& (breathLeft >= getBreathReserve(me, opponent, usedUltimateAttacks) || me.getBreath() + me.getRegenBreath() > me.getMaxBreath());
}

/**
 * Implements a paladin fight behavior that selects an appropriate fight action based on various tactical criteria.
 */
class PaladinFightBehavior implements ClassBehavior {
	/**
	 * Chooses the appropriate fight action for the AI fighter based on the current fight situation.
	 *
	 * @param me - The AI player fighter.
	 * @param fightView - The current fight view context.
	 * @returns The chosen fight action.
	 */
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter; // AI will never fight monsters
		const usedGodMoves = getUsedGodMoves(me, opponent);
		const usedUltimateAttacks = me.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.PLAYER.ULTIMATE_ATTACK).length;

		if (this.shouldUseUltimateAttack(me, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK)!;
		}

		if (this.shouldUseDivineAttack(me, fightView, opponent, usedGodMoves, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)!;
		}

		if (this.shouldUseShieldAttack(me, opponent, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK)!;
		}

		if (this.shouldUseRamAttack(me, opponent, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RAM_ATTACK)!;
		}

		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK)!;
	}

	/**
	 * Determines whether the DIVINE_ATTACK should be used based on various tactical conditions.
	 *
	 * Conditions include:
	 * - Opponent's last action is DIVINE_ATTACK and usedGodMoves is less than 2.
	 * - If usedUltimateAttacks equals 1 and usedGodMoves is less than 2.
	 * - If the opponent's class is one of [KNIGHT, VALIANT_KNIGHT, HORSE_RIDER, PIKEMAN, ESQUIRE], with a 20% chance and no god moves used.
	 * - If the opponent's class is PALADIN or LUMINOUS_PALADIN, the last action was DIVINE_ATTACK, or a 20% chance applies, with no god moves used, and the fight turn is at least 8.
	 *
	 * @param me - The AI fighter.
	 * @param fightView - The current fight view.
	 * @param opponent - The opponent fighter.
	 * @param usedGodMoves - The number of god moves used.
	 * @param usedUltimateAttacks - The number of ultimate attacks used.
	 * @returns True if DIVINE_ATTACK should be used; otherwise, false.
	 */
	private shouldUseDivineAttack(
		me: AiPlayerFighter,
		fightView: FightView,
		opponent: RealPlayerFighter | AiPlayerFighter,
		usedGodMoves: number,
		usedUltimateAttacks: number
	): boolean {
		const divineAttackBreathCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK);
		if (me.getBreath() < divineAttackBreathCost || usedGodMoves >= MAX_GOD_MOVES_PER_FIGHT) {
			return false;
		}

		const opponentLastActionId = opponent.getLastFightActionUsed()?.id ?? null;
		const isLastOpponentAttackIsDivineAttack = opponentLastActionId === FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK;
		const isOpponentPaladinType = opponent.player.class === ClassConstants.CLASSES_ID.PALADIN
			|| opponent.player.class === ClassConstants.CLASSES_ID.LUMINOUS_PALADIN;
		const isOpponentKnightType = opponent.player.class === ClassConstants.CLASSES_ID.KNIGHT
			|| opponent.player.class === ClassConstants.CLASSES_ID.VALIANT_KNIGHT
			|| opponent.player.class === ClassConstants.CLASSES_ID.HORSE_RIDER
			|| opponent.player.class === ClassConstants.CLASSES_ID.PIKEMAN
			|| opponent.player.class === ClassConstants.CLASSES_ID.ESQUIRE;

		return (
			(usedUltimateAttacks === 1
				|| (RandomUtils.crowniclesRandom.bool(0.4)
					&& fightView.fightController.turn > 13)
			)
			|| (isOpponentKnightType && RandomUtils.crowniclesRandom.bool(0.2)
				&& usedGodMoves === 0
				&& fightView.fightController.turn > 3)
			|| isOpponentPaladinType
			&& (isLastOpponentAttackIsDivineAttack || RandomUtils.crowniclesRandom.bool(0.2))
			&& fightView.fightController.turn >= 8
		);
	}

	/**
	 * Determines whether the CHARGE_ULTIMATE_ATTACK should be used if the ultimate attack hasn't been used
	 * and energy is below a threshold.
	 *
	 * @param me - The AI fighter.
	 * @param usedUltimateAttacks - The number of ultimate attacks used.
	 * @returns True if CHARGE_ULTIMATE_ATTACK should be used; otherwise, false.
	 */
	private shouldUseUltimateAttack(me: AiPlayerFighter, usedUltimateAttacks: number): boolean {
		const ultimateAttackBreathCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK);
		return me.getEnergy() < me.getMaxEnergy() * 0.45
			&& me.getBreath() >= ultimateAttackBreathCost
			&& RandomUtils.crowniclesRandom.bool(0.80)
			&& usedUltimateAttacks === 0;
	}

	/**
	 * Determines whether the SHIELD_ATTACK should be used.
	 *
	 * The shield attack scales on the paladin's high defense and weakens the opponent, which can only happen
	 * when the opponent has no alteration yet (a fighter holds a single alteration at a time), once per fight.
	 * It is paid with spare breath only, so that it never delays the ultimate or the divine attacks.
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @param usedUltimateAttacks - The number of ultimate attacks used.
	 * @returns True if SHIELD_ATTACK should be used; otherwise, false.
	 */
	private shouldUseShieldAttack(
		me: AiPlayerFighter,
		opponent: RealPlayerFighter | AiPlayerFighter,
		usedUltimateAttacks: number
	): boolean {
		return canPlayShieldAttack(me, opponent)
			&& hasBreathToSpare(me, opponent, usedUltimateAttacks, FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK);
	}

	/**
	 * Determines whether the RAM_ATTACK should be used: to break the opponent's rest or ultimate charge, or to spend
	 * spare breath on an opponent without alteration (never on a stunned one, which would chain the stuns).
	 * Its recoil makes it a poor default attack.
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @param usedUltimateAttacks - The number of ultimate attacks used.
	 * @returns True if RAM_ATTACK should be used; otherwise, false.
	 */
	private shouldUseRamAttack(
		me: AiPlayerFighter,
		opponent: RealPlayerFighter | AiPlayerFighter,
		usedUltimateAttacks: number
	): boolean {
		const ramAttack = FightConstants.FIGHT_ACTIONS.PLAYER.RAM_ATTACK;
		if (me.getBreath() < getBreathCost(ramAttack) || me.getEnergy() < me.getMaxEnergy() * 0.15) {
			return false;
		}
		const opponentLastActionId = opponent.getLastFightActionUsed()?.id;
		const opponentIsPreparing = opponentLastActionId === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
			|| opponentLastActionId === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK;
		if (opponentIsPreparing) {
			return !opponent.hasFightAlteration() || opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.STUNNED;
		}
		return !opponent.hasFightAlteration() && hasBreathToSpare(me, opponent, usedUltimateAttacks, ramAttack);
	}
}

export default PaladinFightBehavior;
