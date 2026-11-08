import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	canPlayShieldAttack, canStrikeWithShieldAttack, SHIELD_ATTACK_CHANCES
} from "./ShieldAttackPacing";
import { shouldCounterAttack } from "./TankFightBehavior";

/**
 * Riposte tank: lets the opponent commit and copies its expensive actions, and only uses the shield attack (to weaken a
 * clean opponent, or to strike one that already suffers another alteration) when it keeps enough breath to counter on its next turn
 */
class TankRiposteFightBehavior implements ClassBehavior {
	// Shield attacks cast on an opponent without alteration, which weakened it: the pacing only limits these
	private weakeningShieldAttacks = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const cost = (actionId: string): number => FightActionDataController.getFightActionBreathCost(actionId);
		if (shouldCounterAttack(me, opponent)) {
			return getAction(actions.COUNTER_ATTACK);
		}

		// Keep enough breath, after the regeneration, to counter on the next turn
		const breathToKeep = cost(actions.COUNTER_ATTACK) - me.getRegenBreath();
		if (canPlayShieldAttack(me, opponent, SHIELD_ATTACK_CHANCES.DECREASING, {
			breathToKeep, weakeningShieldAttacksCast: this.weakeningShieldAttacks
		})) {
			this.weakeningShieldAttacks++;
			return getAction(actions.SHIELD_ATTACK);
		}
		if (canStrikeWithShieldAttack(me, opponent, breathToKeep)) {
			return getAction(actions.SHIELD_ATTACK);
		}
		return getAction(me.getBreath() >= cost(actions.INTENSE_ATTACK) ? actions.INTENSE_ATTACK : actions.SIMPLE_ATTACK);
	}
}

export default TankRiposteFightBehavior;
