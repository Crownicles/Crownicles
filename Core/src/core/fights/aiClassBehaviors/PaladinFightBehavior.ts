import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { getUsedGodMoves } from "../FightController";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";

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
		const divineAndUltimateAttacksUsed = usedGodMoves >= 2 && usedUltimateAttacks > 0;

		if (this.shouldUseUltimateAttack(me, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK)!;
		}

		if (this.shouldUseDivineAttack(me, fightView, opponent, usedGodMoves, usedUltimateAttacks)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)!;
		}

		if (this.shouldUseShieldAttack(me, opponent, divineAndUltimateAttacksUsed)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK)!;
		}

		if (this.shouldUseRamAttack(me, opponent, divineAndUltimateAttacksUsed)) {
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
		if (me.getBreath() < divineAttackBreathCost || usedGodMoves >= 2) {
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
	 * Determines whether the SHIELD_ATTACK should be used to block opponent's two-turn attacks.
	 *
	 * Uses a calculation based on the opponent's breath and random chance.
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @param divineAndUltimateAttacksUsed - Indicator if both divine and ultimate attacks have been used.
	 * @returns True if SHIELD_ATTACK should be used; otherwise, false.
	 */
	private shouldUseShieldAttack(
		me: AiPlayerFighter,
		opponent: RealPlayerFighter | AiPlayerFighter,
		divineAndUltimateAttacksUsed: boolean
	): boolean {
		const breathRange = Math.round(opponent.getBreath() / opponent.getMaxBreath() * 3);
		return (
			!opponent.hasFightAlteration()
			&& (me.getBreath() > 18 || divineAndUltimateAttacksUsed)
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK)
			&& (
				opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING && (
					opponent.player.class === ClassConstants.CLASSES_ID.KNIGHT
					|| opponent.player.class === ClassConstants.CLASSES_ID.VALIANT_KNIGHT
					|| opponent.player.class === ClassConstants.CLASSES_ID.HORSE_RIDER
					|| opponent.player.class === ClassConstants.CLASSES_ID.PIKEMAN
				)
				|| opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK
				|| opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK
				|| opponent.getDefense() > me.getDefense() * 0.9 && RandomUtils.crowniclesRandom.bool([
					0.05,
					0.2,
					0.8
				][breathRange])
			)
		);
	}

	/**
	 * Determines whether the RAM_ATTACK should be used to cancel opponent's two-turn attack (except CHARGE_CHARGING_ATTACK).
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @param divineAndUltimateAttacksUsed - Indicator if both divine and ultimate attacks have been used.
	 * @returns True if RAM_ATTACK should be used; otherwise, false.
	 */
	private shouldUseRamAttack(
		me: AiPlayerFighter,
		opponent: RealPlayerFighter | AiPlayerFighter,
		divineAndUltimateAttacksUsed: boolean
	): boolean {
		const ramAttackBreathCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.RAM_ATTACK);
		return (
			(!opponent.hasFightAlteration() || opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.STUNNED)
			&& (me.getBreath() > 17 || divineAndUltimateAttacksUsed
				|| opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK && opponent.getBreath() >= 2)
			&& me.getBreath() >= ramAttackBreathCost
			&& me.getEnergy() >= me.getMaxEnergy() * 0.15
			&& opponent.getLastFightActionUsed()?.id !== FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK
		);
	}
}

export default PaladinFightBehavior;
