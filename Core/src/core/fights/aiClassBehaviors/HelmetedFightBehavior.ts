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
import { intenseOrSimpleAttack } from "./GlovedFightBehavior";

/**
 * Determines whether the AI should use an intense or simple attack.
 * @param opponent
 * @param me
 */
export function shouldUseShieldAttack(opponent: AiPlayerFighter | RealPlayerFighter, me: AiPlayerFighter): boolean {
	return ([
		FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK,
		FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK,
		FightConstants.FIGHT_ACTIONS.PLAYER.BOOMERANG_ATTACK,
		FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK
	].includes(opponent.getLastFightActionUsed()?.id)
			|| opponent.getBreath() > opponent.getMaxBreath() * 0.85)
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK)
		&& RandomUtils.crowniclesRandom.bool(0.8);
}

class TankFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const turn = fightView.fightController.turn;

		if (
			me.getDefense() < 600
			&& turn < 3
			&& ![
				ClassConstants.CLASSES_ID.KNIGHT,
				ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
				ClassConstants.CLASSES_ID.PIKEMAN,
				ClassConstants.CLASSES_ID.ESQUIRE,
				ClassConstants.CLASSES_ID.HORSE_RIDER
			].includes(opponent.player.class)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DEFENSE_BUFF);
		}

		if (shouldUseShieldAttack(opponent, me)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK);
		}

		return intenseOrSimpleAttack(me, opponent);
	}
}

export default TankFightBehavior;
