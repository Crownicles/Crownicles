import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";

// Under this share of its energy, the veteran uses the energetic attack for its heal
const HEALING_ENERGY_RATIO = 0.6;

// The two-turn charging attack is not started against an opponent this close to death
const MIN_OPPONENT_ENERGY_RATIO_TO_CHARGE = 0.16;

/**
 * Charger veteran: favors the two-turn charging attacks and keeps the energetic attack to heal when hurt
 */
class VeteranChargerFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
		const opponentLastActionId = opponent.getLastFightActionUsed()?.id;

		if (fightView.fightController.turn <= 2) {
			return getAction(actions.CONCENTRATION);
		}

		// The energetic attack also punishes an opponent that has just rested
		if ((me.getEnergy() < me.getMaxEnergy() * HEALING_ENERGY_RATIO || opponentLastActionId === actions.RESTING) && canUse(actions.ENERGETIC_ATTACK)) {
			return getAction(actions.ENERGETIC_ATTACK);
		}

		// Do not charge into an opponent that is itself preparing a two-turn action
		const opponentIsCharging = opponentLastActionId === actions.CHARGE_ULTIMATE_ATTACK
			|| opponentLastActionId === actions.CHARGE_CHARGING_ATTACK
			|| opponentLastActionId === actions.RESTING;
		if (
			canUse(actions.CHARGE_CHARGING_ATTACK)
			&& !opponentIsCharging
			&& opponent.getEnergy() > opponent.getMaxEnergy() * MIN_OPPONENT_ENERGY_RATIO_TO_CHARGE
		) {
			return getAction(actions.CHARGE_CHARGING_ATTACK);
		}

		if (me.getSpeed() > opponent.getSpeed() && canUse(actions.QUICK_ATTACK)) {
			return getAction(actions.QUICK_ATTACK);
		}

		return canUse(actions.PIERCING_ATTACK) ? getAction(actions.PIERCING_ATTACK) : getAction(actions.QUICK_ATTACK);
	}
}

export default VeteranChargerFightBehavior;
