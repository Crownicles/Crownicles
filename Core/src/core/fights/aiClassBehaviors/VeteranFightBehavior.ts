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
 * Implements a veteran fight behavior that selects an appropriate fight action based on various tactical criteria.
 */
class VeteranFightBehavior implements ClassBehavior {
	/**
	 * Chooses the appropriate fight action for the AI fighter based on the current fight situation.
	 *
	 * @param me - The AI player fighter.
	 * @param fightView - The current fight view context.
	 * @returns The chosen fight action.
	 */
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter; // AI will never fight monsters

		if (this.shouldUseConcentration(me, fightView, opponent)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CONCENTRATION);
		}

		if (this.shouldUseEnergeticAttack(me)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
		}

		if (this.shouldUseChargingAttack(me, opponent)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK);
		}

		if (this.shouldUseQuickAttack(me, opponent)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK);
		}

		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.PIERCING_ATTACK);
	}

	/**
	 * Determines whether the concentration action should be used.
	 *
	 * Conditions:
	 * - Always on the first turn.
	 * - If no fight alteration is active, if a random check passes, if enough energy is available,
	 * and if the opponent belongs to certain classes or specific breath values are met.
	 *
	 * @param me - The AI fighter.
	 * @param fightView - The current fight view.
	 * @param opponent - The opponent fighter.
	 * @returns True if concentration should be used; otherwise, false.
	 */
	private shouldUseConcentration(me: AiPlayerFighter, fightView: FightView, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
		// Always use concentration on the first turn.
		if (fightView.fightController.turn === 1) {
			return true;
		}

		// If no fight alteration, random check, energy condition and specific class or breath matches trigger concentration.
		if (
			!me.hasFightAlteration()
			&& RandomUtils.crowniclesRandom.bool()
			&& me.getEnergy() > me.getMaxEnergy() * 0.15
		) {
			const concentrationClasses = [
				ClassConstants.CLASSES_ID.MYSTIC_MAGE,
				ClassConstants.CLASSES_ID.ROCK_THROWER,
				ClassConstants.CLASSES_ID.SLINGER,
				ClassConstants.CLASSES_ID.ARCHER,
				ClassConstants.CLASSES_ID.GUNNER,
				ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER
			];

			if (concentrationClasses.includes(opponent.player.class) || me.getBreath() === 7 || me.getBreath() === 8) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if the energetic attack can be used based on the fighter's breath level.
	 *
	 * @param me - The AI fighter.
	 * @returns True if there is enough breath to perform an energetic attack; otherwise, false.
	 */
	private shouldUseEnergeticAttack(me: AiPlayerFighter): boolean {
		return me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
	}

	/**
	 * Determines whether a charging attack should be used. Two conditions trigger a charging attack:
	 * 1. The opponent is charging a two-turn attack.
	 * 2. Tactical conditions are met, favoring non-knight opponents.
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @returns True if a charging attack should be used; otherwise, false.
	 */
	private shouldUseChargingAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
		const chargingBreathCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK);
		if (me.getBreath() < chargingBreathCost) {
			return false;
		}

		const opponentLastAction = opponent.getLastFightActionUsed();

		// Condition 1: Opponent is charging a two-turn attack.
		if (opponentLastAction) {
			const actionId = opponentLastAction.id;

			if (
				actionId === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK
				|| (actionId === FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK
					&& opponent.getBreath() >= 2)
				|| actionId === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK
				|| (actionId === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
					&& (
						opponent.player.class === ClassConstants.CLASSES_ID.KNIGHT
						|| opponent.player.class === ClassConstants.CLASSES_ID.VALIANT_KNIGHT
						|| opponent.player.class === ClassConstants.CLASSES_ID.HORSE_RIDER
						|| opponent.player.class === ClassConstants.CLASSES_ID.PIKEMAN
					)
					&& RandomUtils.crowniclesRandom.bool(0.6))
			) {
				return true;
			}
		}

		// Condition 2: Tactical advantage against non-knight opponents.
		return me.getEnergy() > me.getMaxEnergy() * 0.21
			&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.16
			&& (opponent.player.class !== ClassConstants.CLASSES_ID.MYSTIC_MAGE || me.hasFightAlteration())
			&& opponent.player.class !== ClassConstants.CLASSES_ID.KNIGHT
			&& opponent.player.class !== ClassConstants.CLASSES_ID.VALIANT_KNIGHT
			&& opponent.player.class !== ClassConstants.CLASSES_ID.HORSE_RIDER
			&& opponent.player.class !== ClassConstants.CLASSES_ID.PIKEMAN
			&& opponent.player.class !== ClassConstants.CLASSES_ID.ESQUIRE;
	}

	/**
	 * Determines whether a quick attack should be used based on the opponent's speed and random factors.
	 *
	 * @param me - The AI fighter.
	 * @param opponent - The opponent fighter.
	 * @returns True if a quick attack should be used; otherwise, false.
	 */
	private shouldUseQuickAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
		if (opponent.getSpeed() < me.getSpeed() * 0.4) {
			return true;
		}
		if (RandomUtils.crowniclesRandom.bool() && opponent.getSpeed() < me.getSpeed() * 0.6) {
			return true;
		}
		return RandomUtils.crowniclesRandom.bool(0.2);
	}
}

export default VeteranFightBehavior;
