import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";

/**
 * Determines whether the AI should use an intense or simple attack.
 * @param me
 * @param opponent
 */
export function intenseOrSimpleAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): FightAction {
	if (
		me.getEnergy() < opponent.getEnergy()
		&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.15
		&& FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.INTENSE_ATTACK)
		&& RandomUtils.crowniclesRandom.bool(0.8)
	) {
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.INTENSE_ATTACK);
	}

	// Any other case, use a simple attack
	return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK);
}

class GlovedFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;

		if (
			me.getDefense() < 600
			&& ![
				ClassConstants.CLASSES_ID.KNIGHT,
				ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
				ClassConstants.CLASSES_ID.PIKEMAN,
				ClassConstants.CLASSES_ID.ESQUIRE,
				ClassConstants.CLASSES_ID.HORSE_RIDER
			].includes(opponent.player.class)
			&& RandomUtils.crowniclesRandom.bool(0.2)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DEFENSE_BUFF);
		}
		return intenseOrSimpleAttack(me, opponent);
	}
}

export default GlovedFightBehavior;
