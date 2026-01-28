import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { PlayerFighter } from "../fighter/PlayerFighter";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import {
	piercingOrSimpleAttack, shouldProtect
} from "./RecruitFightBehavior";

class InfantryManFightBehavior implements ClassBehavior {
	private powerfulAttacksUsedMap = 0;

	private isOpponentCharging(opponent: PlayerFighter | AiPlayerFighter): boolean {
		const opponentLastAction = opponent.getLastFightActionUsed();
		return opponentLastAction !== null && (
			(opponentLastAction.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
				&& this.isOpponentKnightLike(opponent)
				&& RandomUtils.crowniclesRandom.bool(0.6))
			|| opponentLastAction.id === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK
			|| (opponentLastAction.id === FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK && opponent.getBreath() >= 2)
			|| opponentLastAction.id === FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK
		);
	}

	/**
	 * Determines if the AI has a tactical advantage based on various conditions.
	 * @param me
	 * @param opponent
	 * @param fightView
	 * @param powerfulAttacksUsed
	 */
	private hasTacticalAdvantage(me: AiPlayerFighter, opponent: PlayerFighter | AiPlayerFighter, fightView: FightView, powerfulAttacksUsed: number): boolean {
		return (fightView.fightController.turn > 11 || powerfulAttacksUsed > 2)
			&& me.getEnergy() > me.getMaxEnergy() * 0.21
			&& (opponent.player.class !== ClassConstants.CLASSES_ID.MYSTIC_MAGE || me.hasFightAlteration())
			&& (RandomUtils.crowniclesRandom.bool() || opponent.getDefense() < me.getDefense());
	}

	/**
	 * Determines if the opponent is not a knight-like class.
	 * @param opponent
	 */
	private isOpponentKnightLike(opponent: PlayerFighter | AiPlayerFighter): boolean {
		const knightLikeClasses = [
			ClassConstants.CLASSES_ID.KNIGHT,
			ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
			ClassConstants.CLASSES_ID.HORSE_RIDER,
			ClassConstants.CLASSES_ID.PIKEMAN,
			ClassConstants.CLASSES_ID.ESQUIRE
		];
		return knightLikeClasses.includes(opponent.player.class);
	}

	private shouldUseChargingAttack(me: AiPlayerFighter, opponent: PlayerFighter | AiPlayerFighter, fightView: FightView, powerfulAttacksUsed: number): boolean {
		return this.isOpponentCharging(opponent)
			|| (this.hasTacticalAdvantage(me, opponent, fightView, powerfulAttacksUsed)
				&& !this.isOpponentKnightLike(opponent));
	}

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const powerfulAttacksUsed = this.powerfulAttacksUsedMap;
		const opponent = fightView.fightController.getDefendingFighter() as PlayerFighter | AiPlayerFighter; // AI will never fight monsters

		if (shouldProtect(opponent, me, fightView.fightController.turn)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.PROTECTION)!;
		}

		// Priority is to use powerful attacks
		if (
			powerfulAttacksUsed <= 2
			&& RandomUtils.crowniclesRandom.bool(0.9) // Add a bit of randomness here to avoid being too predictable
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.POWERFUL_ATTACK)
		) {
			this.powerfulAttacksUsedMap++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.POWERFUL_ATTACK)!;
		}

		if (me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK)
			&& this.shouldUseChargingAttack(me, opponent, fightView, powerfulAttacksUsed)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK)!;
		}

		return piercingOrSimpleAttack(opponent, me);
	}
}

export default InfantryManFightBehavior;
