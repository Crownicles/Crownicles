import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	chooseFinishingMove, shouldUseIntenseAttack
} from "./GunnerFightBehavior";

// Below this share of energy, the opponent is finished with a cheap attack
const FINISHING_ENERGY_RATIO = 0.06;

/**
 * Bombardier gunner: opens with the boomerang, then fires a canon whenever its breath is full and keeps chaining canons
 * (each repeated canon deals 50% more damage) while it can
 */
class GunnerBombardierFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);

		if (opponent.getEnergy() <= opponent.getMaxEnergy() * FINISHING_ENERGY_RATIO) {
			return chooseFinishingMove(me, opponent);
		}

		if (me.getLastFightActionUsed()?.id === actions.CANON_ATTACK && canUse(actions.CANON_ATTACK)) {
			return getAction(actions.CANON_ATTACK);
		}

		if (fightView.fightController.turn <= 2 && !opponent.hasFightAlteration() && canUse(actions.BOOMERANG_ATTACK)) {
			return getAction(actions.BOOMERANG_ATTACK);
		}

		// Start a new chain with a full breath, enough for several canons in a row
		if (me.getBreath() >= me.getMaxBreath() - 1 && canUse(actions.CANON_ATTACK)) {
			return getAction(actions.CANON_ATTACK);
		}

		if (shouldUseIntenseAttack(opponent, me, false)) {
			return getAction(actions.INTENSE_ATTACK);
		}

		return chooseFinishingMove(me, opponent);
	}
}

export default GunnerBombardierFightBehavior;
