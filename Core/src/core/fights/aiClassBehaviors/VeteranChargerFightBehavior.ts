import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	shouldChargerUseEnergeticAttack, shouldStartChargingAttack
} from "./VeteranTactics";

// Under this share of its energy, the veteran uses the energetic attack for its heal
const HEALING_ENERGY_RATIO = 0.6;

/**
 * Charger veteran: favors the two-turn charging attacks and keeps the energetic attack to heal when hurt
 */
class VeteranChargerFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);

		if (fightView.fightController.turn <= 2) {
			return getAction(actions.CONCENTRATION);
		}

		if (shouldChargerUseEnergeticAttack(me, opponent, HEALING_ENERGY_RATIO)) {
			return getAction(actions.ENERGETIC_ATTACK);
		}

		if (shouldStartChargingAttack(me, opponent)) {
			return getAction(actions.CHARGE_CHARGING_ATTACK);
		}

		const preferQuick = me.getSpeed() > opponent.getSpeed() && canUse(actions.QUICK_ATTACK) || !canUse(actions.PIERCING_ATTACK);
		return getAction(preferQuick ? actions.QUICK_ATTACK : actions.PIERCING_ATTACK);
	}
}

export default VeteranChargerFightBehavior;
