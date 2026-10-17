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
import { shouldUseShieldAttack } from "./HelmetedFightBehavior";

class TankFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const turn = fightView.fightController.turn;

		const lastOpponentAction = opponent.getLastFightActionUsed();

		if (
			(me.getDefense() < 600
				|| RandomUtils.crowniclesRandom.bool(0.1))
			&& (turn < 3
				|| RandomUtils.crowniclesRandom.bool(0.1))
			&& ![
				ClassConstants.CLASSES_ID.KNIGHT,
				ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
				ClassConstants.CLASSES_ID.PIKEMAN,
				ClassConstants.CLASSES_ID.ESQUIRE,
				ClassConstants.CLASSES_ID.HORSE_RIDER
			].includes(opponent.player.class)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DEFENSE_BUFF)!;
		}

		if (shouldUseShieldAttack(opponent, me)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SHIELD_ATTACK)!;
		}

		if (
			turn > 1
				&& lastOpponentAction // Check if lastOpponentAction is not null
				&& !FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastOpponentAction.id)
				&& lastOpponentAction.id !== FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK
				&& FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.COUNTER_ATTACK)
				&& lastOpponentAction.breath > 4 // Don't copy attacks that cost a small amount of breath
				&& RandomUtils.crowniclesRandom.bool(0.95)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.COUNTER_ATTACK)!;
		}

		return intenseOrSimpleAttack(me, opponent);
	}
}

export default TankFightBehavior;
