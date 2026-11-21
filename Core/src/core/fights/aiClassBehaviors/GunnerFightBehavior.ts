import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { FightAction } from "../../../data/FightAction";
import { PlayerBaseFighter } from "../fighter/PlayerBaseFighter";
import { GunnerCanonPlan } from "./GunnerCanonPlan";

// The strategist starts a canon chain two points of breath below its maximum
const CANON_CHAIN_BREATH_MARGIN = 2;

/**
 * Strategist gunner: opens with the boomerang, fires canon chains as soon as it has the breath for them, and wears its
 * opponent down with intense and sabotage attacks between two chains
 */
class GunnerFightBehavior implements ClassBehavior {
	private readonly plan = new GunnerCanonPlan(CANON_CHAIN_BREATH_MARGIN);

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as PlayerBaseFighter;
		return this.plan.chooseAction(me, opponent, fightView.fightController.turn);
	}
}

export default GunnerFightBehavior;
