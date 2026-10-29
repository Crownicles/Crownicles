import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { canPlayShieldAttack } from "./ShieldAttackPacing";
import { shouldCounterAttack } from "./TankFightBehavior";

/**
 * Riposte tank: lets the opponent commit and copies its expensive actions, and only weakens it with the shield attack
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

		// Keep enough breath, after the regeneration, to counter on the next turn
		if (canPlayShieldAttack(me, opponent, cost(actions.COUNTER_ATTACK) - me.getRegenBreath())) {
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
