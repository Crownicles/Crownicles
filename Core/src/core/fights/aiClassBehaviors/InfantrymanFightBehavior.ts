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
import { piercingOrSimpleAttack } from "./RecruitFightBehavior";
import {
	isOpponentCharging, isOpponentKnightLike, shouldOpenWithChargedAttack, shouldProtectAgainstControl
} from "./InfantrymanTactics";

class InfantryManFightBehavior implements ClassBehavior {
	private powerfulAttacksUsedMap = 0;

	/**
	 * Determines if the AI has a tactical advantage based on various conditions.
	 * @param me
	 * @param opponent
	 * @param fightView
	 * @param powerfulAttacksUsed
	 */
	private hasTacticalAdvantage(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, fightView: FightView, powerfulAttacksUsed: number): boolean {
		return (fightView.fightController.turn > 11 || powerfulAttacksUsed > 2)
			&& me.getEnergy() > me.getMaxEnergy() * 0.21
			&& (opponent.player.class !== ClassConstants.CLASSES_ID.MYSTIC_MAGE || me.hasFightAlteration())
			&& (RandomUtils.crowniclesRandom.bool() || opponent.getDefense() < me.getDefense());
	}

	private shouldUseChargingAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, fightView: FightView, powerfulAttacksUsed: number): boolean {
		return isOpponentCharging(opponent)
			|| (this.hasTacticalAdvantage(me, opponent, fightView, powerfulAttacksUsed)
				&& !isOpponentKnightLike(opponent));
	}

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const powerfulAttacksUsed = this.powerfulAttacksUsedMap;
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter; // AI will never fight monsters

		if (shouldOpenWithChargedAttack(me, fightView.fightController.turn)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK)!;
		}

		// The protection is kept for the classes that would chain their controls: against the others, attacking won more fights
		if (shouldProtectAgainstControl(me, opponent)) {
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
