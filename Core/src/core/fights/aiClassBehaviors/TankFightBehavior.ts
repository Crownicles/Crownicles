import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	canPlayShieldAttack, SHIELD_ATTACK_CHANCES
} from "./ShieldAttackPacing";

// Above this number of defense buffs the tank keeps attacking instead of stacking more defense
const MAX_DEFENSE_BUFFS = 4;

// Opponent actions costing this much breath or less are not worth copying with a counter-attack
const MAX_IGNORED_COUNTER_BREATH = 5;

/**
 * Check if the tank should copy the last action of its opponent: worth it only for an expensive, counterable action
 * @param me
 * @param opponent
 */
export function shouldCounterAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
	const lastOpponentAction = opponent.getLastFightActionUsed();
	if (!lastOpponentAction) {
		return false;
	}
	return !FightConstants.UNCOUNTERABLE_ACTIONS.includes(lastOpponentAction.id)
		&& lastOpponentAction.breath > MAX_IGNORED_COUNTER_BREATH
		&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.COUNTER_ATTACK);
}

class TankFightBehavior implements ClassBehavior {
	private defenseBuffsUsed = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const turn = fightView.fightController.turn;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);

		// Opening: raise the defense, which also feeds the damage of the shield attack
		if (turn < 3 && canUse(actions.DEFENSE_BUFF)) {
			this.defenseBuffsUsed++;
			return FightActionDataController.instance.getById(actions.DEFENSE_BUFF)!;
		}

		/*
		 * The shield attack weakens the opponent, only used on an opponent without alteration and less and less likely
		 * with each use: chaining it would keep the opponent weakened for the whole fight, which is no fun to fight against
		 */
		if (canPlayShieldAttack(me, opponent, SHIELD_ATTACK_CHANCES.DECREASING)) {
			return FightActionDataController.instance.getById(actions.SHIELD_ATTACK)!;
		}

		if (shouldCounterAttack(me, opponent)) {
			return FightActionDataController.instance.getById(actions.COUNTER_ATTACK)!;
		}

		if (
			this.defenseBuffsUsed < MAX_DEFENSE_BUFFS
			&& opponent.hasFightAlteration()
			&& !canUse(actions.SHIELD_ATTACK)
			&& canUse(actions.DEFENSE_BUFF)
		) {
			this.defenseBuffsUsed++;
			return FightActionDataController.instance.getById(actions.DEFENSE_BUFF)!;
		}

		if (
			me.getEnergy() < opponent.getEnergy()
			&& opponent.getEnergy() > opponent.getMaxEnergy() * 0.15
			&& canUse(actions.INTENSE_ATTACK)
		) {
			return FightActionDataController.instance.getById(actions.INTENSE_ATTACK)!;
		}

		return FightActionDataController.instance.getById(actions.SIMPLE_ATTACK)!;
	}
}

export default TankFightBehavior;
