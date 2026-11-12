import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { FightAction } from "../../../data/FightAction";
import { PlayerBaseFighter } from "../fighter/PlayerBaseFighter";
import { GunnerCanonPlan } from "./GunnerCanonPlan";

// The bombardier waits for a breath one point below its maximum before starting a canon chain
const CANON_CHAIN_BREATH_MARGIN = 1;

/**
 * Bombardier gunner: opens with the boomerang and fires canon chains once its breath is nearly full, sabotaging its
 * opponent in the meantime
 */
class GunnerBombardierFightBehavior implements ClassBehavior {
	private readonly plan = new GunnerCanonPlan(CANON_CHAIN_BREATH_MARGIN);

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as PlayerBaseFighter;
		return this.plan.chooseAction(me, opponent, fightView.fightController.turn);
	}
}

export default GunnerBombardierFightBehavior;
