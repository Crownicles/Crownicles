import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { PlayerBaseFighter } from "../fighter/PlayerBaseFighter";
import {
	canPlayShieldAttack, canStrikeWithShieldAttack, SHIELD_ATTACK_CHANCES
} from "./ShieldAttackPacing";

// Opponent actions costing this much breath or less are not worth copying with a counter-attack
const MAX_IGNORED_COUNTER_BREATH = 5;

/**
 * Check if the tank should copy the last action of its opponent: worth it only for an expensive, counterable action
 * @param me
 * @param opponent
 */
export function shouldCounterAttack(me: AiPlayerFighter, opponent: PlayerBaseFighter): boolean {
	const lastOpponentAction = opponent.getLastFightActionUsed();
	if (!lastOpponentAction) {
		return false;
	}
	return !FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastOpponentAction.id)
		&& lastOpponentAction.breath > MAX_IGNORED_COUNTER_BREATH
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.COUNTER_ATTACK);
}

/**
 * Bulwark tank: raises its defense at the opening, weakens its opponent with its shield, strikes with the shield an
 * opponent that already suffers another alteration, copies its expensive actions, and hits as hard as its breath allows
 */
class TankFightBehavior implements ClassBehavior {
	// Shield attacks cast on an opponent without alteration, which weakened it: the pacing only limits these
	private weakeningShieldAttacks = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as PlayerBaseFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);

		// Opening: raise the defense, which also feeds the damage of the shield attack
		if (fightView.fightController.turn < 3 && canUse(actions.DEFENSE_BUFF)) {
			return getAction(actions.DEFENSE_BUFF);
		}

		/*
		 * The shield attack weakens the opponent, only used on an opponent without alteration and less and less likely
		 * with each use: chaining it would keep the opponent weakened for the whole fight, which is no fun to fight against
		 */
		if (canPlayShieldAttack(me, opponent, SHIELD_ATTACK_CHANCES.DECREASING, { weakeningShieldAttacksCast: this.weakeningShieldAttacks })) {
			this.weakeningShieldAttacks++;
			return getAction(actions.SHIELD_ATTACK);
		}
		if (canStrikeWithShieldAttack(me, opponent)) {
			return getAction(actions.SHIELD_ATTACK);
		}

		if (shouldCounterAttack(me, opponent)) {
			return getAction(actions.COUNTER_ATTACK);
		}

		// The intense attack is worth its breath against any opponent: stacking more defense buffs lost more fights
		return getAction(canUse(actions.INTENSE_ATTACK) ? actions.INTENSE_ATTACK : actions.SIMPLE_ATTACK);
	}
}

export default TankFightBehavior;
