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

		if (opponent.getEnergy() <= opponent.getMaxEnergy() * FINISHING_ENERGY_RATIO) {
			return chooseFinishingMove(me, opponent);
		}

		const planned = this.chooseCanonPlan(me, opponent, fightView.fightController.turn);
		if (planned) {
			return planned;
		}

		if (shouldUseIntenseAttack(opponent, me, false)) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.INTENSE_ATTACK)!;
		}

		return chooseFinishingMove(me, opponent);
	}

	/**
	 * Boomerang opening and canon chains: keeps chaining canons, opens with the boomerang, and starts a new chain
	 * with a full breath, enough for several canons in a row. Null when none applies
	 */
	private chooseCanonPlan(me: AiPlayerFighter, opponent: RealPlayerFighter, turn: number): FightAction | null {
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
		const canFireCanon = canUse(actions.CANON_ATTACK);
		const isOpening = turn <= 2 && !opponent.hasFightAlteration();

		if (canFireCanon && me.getLastFightActionUsed()?.id === actions.CANON_ATTACK) {
			return FightActionDataController.instance.getById(actions.CANON_ATTACK)!;
		}
		if (isOpening && canUse(actions.BOOMERANG_ATTACK)) {
			return FightActionDataController.instance.getById(actions.BOOMERANG_ATTACK)!;
		}
		if (canFireCanon && me.getBreath() >= me.getMaxBreath() - 1) {
			return FightActionDataController.instance.getById(actions.CANON_ATTACK)!;
		}
		return null;
	}
}

export default GunnerBombardierFightBehavior;
