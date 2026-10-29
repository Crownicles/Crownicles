import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	canConcentrateForNextEnergeticAttack, shouldPunishRest, shouldUseConcentratedEnergeticAttack
} from "./VeteranTactics";

/**
 * Charger veteran: concentrates as soon as its next energetic attack is affordable and releases it right away,
 * without the charging attack the strategist keeps against an opponent preparing a big move
 */
class VeteranChargerFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;
		const canUse = (actionId: string): boolean => me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);

		if (shouldUseConcentratedEnergeticAttack(me) || shouldPunishRest(me, opponent)) {
			return getAction(actions.ENERGETIC_ATTACK);
		}
		if (canConcentrateForNextEnergeticAttack(me)) {
			return getAction(actions.CONCENTRATION);
		}
		if (canUse(actions.ENERGETIC_ATTACK)) {
			return getAction(actions.ENERGETIC_ATTACK);
		}

		// The cheap quick attack lets the breath build up for the next concentration and energetic attack
		return getAction(canUse(actions.QUICK_ATTACK) ? actions.QUICK_ATTACK : actions.CONCENTRATION);
	}
}

export default VeteranChargerFightBehavior;
