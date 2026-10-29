import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { shouldCounterAttack } from "./TankFightBehavior";

/**
 * Riposte tank: lets the opponent commit and copies its expensive actions, and only uses the shield attack
 * when it keeps enough breath to counter on its next turn
 */
class TankRiposteFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const cost = (actionId: string): number => FightActionDataController.getFightActionBreathCost(actionId);

		if (fightView.fightController.turn < 3 && me.getBreath() >= cost(actions.DEFENSE_BUFF)) {
			return getAction(actions.DEFENSE_BUFF);
		}

		if (shouldCounterAttack(me, opponent)) {
			return getAction(actions.COUNTER_ATTACK);
		}

		// The shield attack is worth it even against an opponent it can no longer weaken
		if (me.getBreath() - cost(actions.SHIELD_ATTACK) + me.getRegenBreath() >= cost(actions.COUNTER_ATTACK)) {
			return getAction(actions.SHIELD_ATTACK);
		}

		const behindOpponent = me.getEnergy() < opponent.getEnergy() && opponent.getEnergy() > opponent.getMaxEnergy() * 0.15;
		if (behindOpponent && me.getBreath() >= cost(actions.INTENSE_ATTACK)) {
			return getAction(actions.INTENSE_ATTACK);
		}

		return getAction(actions.SIMPLE_ATTACK);
	}
}

export default TankRiposteFightBehavior;
